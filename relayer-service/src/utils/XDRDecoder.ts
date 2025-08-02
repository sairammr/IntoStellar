/**
 * @fileoverview XDR decoder utility for Soroban contract events and function calls
 */

import { xdr } from "@stellar/stellar-sdk";
import { Logger } from "./Logger";

export interface DecodedContractEvent {
  type: string;
  topics: any[];
  data: any;
  contractId: string;
  ledger: number;
  timestamp: number;
}

export interface DecodedFunctionCall {
  functionName: string;
  args: any[];
  contractId: string;
}

export interface DecodedTransactionResult {
  success: boolean;
  returnValue?: any;
  events: DecodedContractEvent[];
  error?: string;
}

/**
 * XDR decoder for Soroban contract interactions
 */
export class XDRDecoder {
  private logger = Logger.getInstance();

  /**
   * Decode contract events from transaction result metadata
   */
  decodeContractEvents(resultMetaXdr: string): DecodedContractEvent[] {
    try {
      const resultMeta = xdr.TransactionResultMeta.fromXDR(
        resultMetaXdr,
        "base64"
      );
      const events: DecodedContractEvent[] = [];

      // Parse Soroban transaction metadata
      const sorobanMeta = resultMeta.v3()?.sorobanMeta();
      if (!sorobanMeta) {
        return events;
      }

      // Extract events from return value
      const returnValue = sorobanMeta.returnValue();
      if (returnValue) {
        const decodedEvents = this.decodeEventsFromReturnValue(returnValue);
        events.push(...decodedEvents);
      }

      // Extract events from diagnostic events
      const diagnosticEvents = sorobanMeta.diagnosticEvents();
      if (diagnosticEvents) {
        for (const diagnosticEvent of diagnosticEvents) {
          const decodedEvent = this.decodeDiagnosticEvent(diagnosticEvent);
          if (decodedEvent) {
            events.push(decodedEvent);
          }
        }
      }

      return events;
    } catch (error) {
      this.logger.error("Failed to decode contract events from XDR:", error);
      return [];
    }
  }

  /**
   * Decode function call from invoke host function operation
   */
  decodeFunctionCall(operationXdr: string): DecodedFunctionCall | null {
    try {
      const invokeOp = xdr.InvokeHostFunctionOp.fromXDR(operationXdr, "base64");

      // Extract function name
      const functionName = this.decodeScVal(invokeOp.functionName());

      // Extract arguments
      const args = invokeOp.args().map((arg) => this.decodeScVal(arg));

      return {
        functionName: functionName as string,
        args,
        contractId: invokeOp.hostFunction().contractId()?.toString() || "",
      };
    } catch (error) {
      this.logger.error("Failed to decode function call from XDR:", error);
      return null;
    }
  }

  /**
   * Decode transaction result
   */
  decodeTransactionResult(
    resultXdr: string,
    resultMetaXdr: string
  ): DecodedTransactionResult {
    try {
      const result = xdr.TransactionResult.fromXDR(resultXdr, "base64");
      const events = this.decodeContractEvents(resultMetaXdr);

      // Check if transaction was successful
      const success =
        result.result().switch() === xdr.TransactionResultCode.txSuccess();

      // Extract return value if successful
      let returnValue: any = undefined;
      if (success) {
        const operations = result.result().results();
        if (operations && operations.length > 0) {
          const lastOp = operations[operations.length - 1];
          if (lastOp.tr().switch() === xdr.OperationType.invokeHostFunction()) {
            const invokeResult = lastOp.tr().invokeHostFunctionResult();
            if (
              invokeResult.switch() ===
              xdr.InvokeHostFunctionResultCode.invokeHostFunctionSuccess()
            ) {
              returnValue = this.decodeScVal(invokeResult.success());
            }
          }
        }
      }

      return {
        success,
        returnValue,
        events,
        error: success ? undefined : result.result().switch().toString(),
      };
    } catch (error) {
      this.logger.error("Failed to decode transaction result:", error);
      return {
        success: false,
        events: [],
        error: error.message,
      };
    }
  }

  /**
   * Decode ScVal to JavaScript value
   */
  private decodeScVal(scVal: xdr.ScVal): any {
    switch (scVal.switch()) {
      case xdr.ScValType.scvBool():
        return scVal.b();

      case xdr.ScValType.scvVoid():
        return undefined;

      case xdr.ScValType.scvError():
        return { error: scVal.error().toString() };

      case xdr.ScValType.scvU32():
        return scVal.u32();

      case xdr.ScValType.scvI32():
        return scVal.i32();

      case xdr.ScValType.scvU64():
        return scVal.u64().toString();

      case xdr.ScValType.scvI64():
        return scVal.i64().toString();

      case xdr.ScValType.scvU128():
        return scVal.u128().toString();

      case xdr.ScValType.scvI128():
        return scVal.i128().toString();

      case xdr.ScValType.scvU256():
        return scVal.u256().toString();

      case xdr.ScValType.scvI256():
        return scVal.i256().toString();

      case xdr.ScValType.scvBytes():
        return scVal.bytes().toString("hex");

      case xdr.ScValType.scvString():
        return scVal.str().toString();

      case xdr.ScValType.scvSymbol():
        return scVal.sym().toString();

      case xdr.ScValType.scvVec():
        return scVal.vec().map((val) => this.decodeScVal(val));

      case xdr.ScValType.scvMap():
        const map = scVal.map();
        const result: Record<string, any> = {};
        for (const entry of map) {
          const key = this.decodeScVal(entry.key());
          const value = this.decodeScVal(entry.val());
          result[key] = value;
        }
        return result;

      case xdr.ScValType.scvAddress():
        const address = scVal.address();
        switch (address.switch()) {
          case xdr.ScAddressType.scAddressTypeAccount():
            return address.accountId().toString();
          case xdr.ScAddressType.scAddressTypeContract():
            return address.contractId().toString();
          default:
            return address.toString();
        }

      case xdr.ScValType.scvContractInstance():
        return {
          contractId: scVal.instance().contractId().toString(),
          wasmHash: scVal.instance().wasmHash().toString("hex"),
        };

      case xdr.ScValType.scvLedgerKeyContractInstance():
        return {
          contractId: scVal.contractId().toString(),
        };

      default:
        this.logger.warn("Unknown ScVal type:", scVal.switch());
        return null;
    }
  }

  /**
   * Decode events from return value
   */
  private decodeEventsFromReturnValue(
    returnValue: xdr.ScVal
  ): DecodedContractEvent[] {
    const events: DecodedContractEvent[] = [];

    try {
      if (returnValue.switch() === xdr.ScValType.scvVec()) {
        const eventVec = returnValue.vec();
        for (const eventVal of eventVec) {
          const decodedEvent = this.decodeContractEvent(eventVal);
          if (decodedEvent) {
            events.push(decodedEvent);
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to decode events from return value:", error);
    }

    return events;
  }

  /**
   * Decode diagnostic event
   */
  private decodeDiagnosticEvent(
    diagnosticEvent: xdr.DiagnosticEvent
  ): DecodedContractEvent | null {
    try {
      const topics = diagnosticEvent
        .topics()
        .map((topic) => this.decodeScVal(topic));
      const data = this.decodeScVal(diagnosticEvent.data());

      return {
        type: "diagnostic",
        topics,
        data,
        contractId: diagnosticEvent.contractId().toString(),
        ledger: diagnosticEvent.ledger().toNumber(),
        timestamp: Date.now(), // Diagnostic events don't have timestamps
      };
    } catch (error) {
      this.logger.error("Failed to decode diagnostic event:", error);
      return null;
    }
  }

  /**
   * Decode contract event
   */
  private decodeContractEvent(
    eventVal: xdr.ScVal
  ): DecodedContractEvent | null {
    try {
      if (eventVal.switch() !== xdr.ScValType.scvVec()) {
        return null;
      }

      const eventVec = eventVal.vec();
      if (eventVec.length < 2) {
        return null;
      }

      // First element should be topics
      const topics = this.decodeScVal(eventVec[0]);
      // Second element should be data
      const data = this.decodeScVal(eventVec[1]);

      // Extract event type from first topic
      const eventType =
        Array.isArray(topics) && topics.length > 0 ? topics[0] : "unknown";

      return {
        type: eventType,
        topics: Array.isArray(topics) ? topics : [topics],
        data,
        contractId: "", // Will be set by caller
        ledger: 0, // Will be set by caller
        timestamp: Date.now(), // Will be set by caller
      };
    } catch (error) {
      this.logger.error("Failed to decode contract event:", error);
      return null;
    }
  }

  /**
   * Encode JavaScript value to ScVal
   */
  encodeScVal(value: any): xdr.ScVal {
    if (value === null || value === undefined) {
      return xdr.ScVal.scvVoid();
    }

    if (typeof value === "boolean") {
      return xdr.ScVal.scvBool(value);
    }

    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        if (value >= 0) {
          return xdr.ScVal.scvU32(value);
        } else {
          return xdr.ScVal.scvI32(value);
        }
      } else {
        throw new Error("Non-integer numbers not supported");
      }
    }

    if (typeof value === "string") {
      return xdr.ScVal.scvString(value);
    }

    if (Array.isArray(value)) {
      const vec = value.map((item) => this.encodeScVal(item));
      return xdr.ScVal.scvVec(vec);
    }

    if (typeof value === "object") {
      const map = Object.entries(value).map(([key, val]) =>
        xdr.ScMapEntry.scMapEntry({
          key: this.encodeScVal(key),
          val: this.encodeScVal(val),
        })
      );
      return xdr.ScVal.scvMap(map);
    }

    throw new Error(`Unsupported value type: ${typeof value}`);
  }

  /**
   * Encode function call arguments
   */
  encodeFunctionArgs(args: any[]): xdr.ScVal[] {
    return args.map((arg) => this.encodeScVal(arg));
  }
}
