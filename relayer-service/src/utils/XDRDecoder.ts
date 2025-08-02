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
      this.logger.debug("Decoding contract events from XDR", {
        resultMetaXdr: resultMetaXdr.substring(0, 100) + "...",
      });

      // Parse the transaction metadata
      const meta = xdr.TransactionMeta.fromXDR(resultMetaXdr, "base64");
      const events: DecodedContractEvent[] = [];

      // Try to access v3 metadata (Soroban)
      try {
        const v3Meta = meta.v3();
        if (v3Meta) {
          this.logger.debug("Found v3 metadata, processing operations...");

          // Process operations if available
          const operations = v3Meta.operations();
          if (operations) {
            for (let i = 0; i < operations.length; i++) {
              const opMeta = operations[i];
              this.logger.debug(`Processing operation ${i}`);

              // Try to access events if available
              try {
                // Check if operation has events (this might be in a different structure)
                if ((opMeta as any).events) {
                  const opEvents = (opMeta as any).events();
                  if (opEvents) {
                    for (const event of opEvents) {
                      try {
                        const decodedEvent = this.decodeContractEvent(event);
                        if (decodedEvent) {
                          events.push(decodedEvent);
                        }
                      } catch (error) {
                        this.logger.warn(
                          "Failed to decode individual event:",
                          error
                        );
                      }
                    }
                  }
                }
              } catch (error) {
                this.logger.debug("No events found in operation:", error);
              }
            }
          }
        }
      } catch (error) {
        this.logger.debug("Not v3 metadata or different structure:", error);
      }

      this.logger.debug(`Decoded ${events.length} contract events`);
      return events;
    } catch (error) {
      this.logger.error("Failed to decode contract events from XDR:", error);
      return [];
    }
  }

  /**
   * Decode a single contract event
   */
  private decodeContractEvent(event: any): DecodedContractEvent | null {
    try {
      // Decode topics if available
      let topics: any[] = [];
      try {
        const eventTopics = event.topics();
        if (eventTopics) {
          topics = eventTopics.map((topic: any) => this.decodeScVal(topic));
        }
      } catch (error) {
        this.logger.debug("No topics found in event:", error);
      }

      // Decode data if available
      let data: any = null;
      try {
        const eventData = event.data();
        if (eventData) {
          data = this.decodeScVal(eventData);
        }
      } catch (error) {
        this.logger.debug("No data found in event:", error);
      }

      // Extract event type from first topic
      const eventType =
        topics.length > 0 ? this.scValToString(topics[0]) : "Unknown";

      // Get contract ID if available
      let contractId = "unknown";
      try {
        contractId = event.contractId().toString();
      } catch (error) {
        this.logger.debug("No contract ID found in event:", error);
      }

      return {
        type: eventType,
        topics: topics.map((topic) => this.scValToJsValue(topic)),
        data: this.scValToJsValue(data),
        contractId: contractId,
        ledger: 0, // Will be set by caller
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.warn("Failed to decode contract event:", error);
      return null;
    }
  }

  /**
   * Convert ScVal to string representation
   */
  private scValToString(scVal: xdr.ScVal): string {
    try {
      const value = this.scValToJsValue(scVal);
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch (error) {
      return "unknown";
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

      return {
        success,
        returnValue: undefined, // Will be extracted when needed
        events,
        error: success ? undefined : result.result().switch().toString(),
      };
    } catch (error) {
      this.logger.error("Failed to decode transaction result:", error);
      return {
        success: false,
        events: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Decode ScVal to JavaScript value
   */
  decodeScVal(scVal: xdr.ScVal): any {
    try {
      return this.scValToJsValue(scVal);
    } catch (error) {
      this.logger.warn("Failed to decode ScVal:", error);
      return undefined;
    }
  }

  /**
   * Convert ScVal to JavaScript value
   */
  private scValToJsValue(scVal: xdr.ScVal): any {
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
        const vec = scVal.vec();
        return vec ? vec.map((item) => this.scValToJsValue(item)) : [];

      case xdr.ScValType.scvMap():
        const map = scVal.map();
        if (!map) return {};
        const result: any = {};
        for (const entry of map) {
          const key = this.scValToJsValue(entry.key());
          const value = this.scValToJsValue(entry.val());
          result[key] = value;
        }
        return result;

      case xdr.ScValType.scvAddress():
        const addr = scVal.address();
        switch (addr.switch()) {
          case xdr.ScAddressType.scAddressTypeAccount():
            return addr.accountId().toString();
          case xdr.ScAddressType.scAddressTypeContract():
            return addr.contractId().toString();
          default:
            return "unknown_address";
        }

      case xdr.ScValType.scvContractInstance():
        return scVal.instance().toString();

      case xdr.ScValType.scvLedgerKeyContractInstance():
        return "unknown_contract_instance";

      default:
        this.logger.warn("Unknown ScVal type:", scVal.switch());
        return "unknown_value";
    }
  }

  /**
   * Encode JavaScript value to ScVal
   */
  encodeScVal(value: any): xdr.ScVal {
    if (value === undefined || value === null) {
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
        // For non-integers, use i32 for now (simplified)
        return xdr.ScVal.scvI32(Math.floor(value));
      }
    }

    if (typeof value === "string") {
      // Check if it's a hex string (likely bytes)
      if (value.startsWith("0x") || /^[0-9a-fA-F]+$/.test(value)) {
        const hexString = value.startsWith("0x") ? value.slice(2) : value;
        return xdr.ScVal.scvBytes(Buffer.from(hexString, "hex"));
      }
      return xdr.ScVal.scvString(value);
    }

    if (Array.isArray(value)) {
      const vec = value.map((item: any) => this.encodeScVal(item));
      return xdr.ScVal.scvVec(vec);
    }

    if (typeof value === "object") {
      const mapEntries: xdr.ScMapEntry[] = [];
      for (const [key, val] of Object.entries(value)) {
        mapEntries.push(
          new xdr.ScMapEntry({
            key: this.encodeScVal(key),
            val: this.encodeScVal(val),
          })
        );
      }
      return xdr.ScVal.scvMap(mapEntries);
    }

    // Default to void for unknown types
    return xdr.ScVal.scvVoid();
  }

  /**
   * Encode function arguments to ScVal array
   */
  encodeFunctionArgs(args: any[]): xdr.ScVal[] {
    return args.map((arg: any) => this.encodeScVal(arg));
  }

  /**
   * Decode function call from operation
   */
  decodeFunctionCall(operation: any): DecodedFunctionCall {
    try {
      if (operation.type !== "invoke_host_function") {
        return {
          functionName: "unknown",
          args: [],
          contractId: "unknown",
        };
      }

      // Extract function name from operation
      const functionName = this.extractFunctionName(operation);

      // Extract arguments from operation parameters
      const args = this.extractFunctionArgs(operation);

      // Extract contract ID
      const contractId = this.extractContractId(operation);

      return {
        functionName,
        args,
        contractId,
      };
    } catch (error) {
      this.logger.error("Failed to decode function call:", error);
      return {
        functionName: "unknown",
        args: [],
        contractId: "unknown",
      };
    }
  }

  /**
   * Extract function name from operation
   */
  private extractFunctionName(operation: any): string {
    try {
      // Try to extract from function field
      if (operation.function) {
        return operation.function;
      }

      // Try to extract from parameters
      if (operation.parameters && operation.parameters.length > 0) {
        // First parameter might contain function name
        const firstParam = operation.parameters[0];
        if (firstParam && firstParam.value) {
          try {
            const decoded = this.decodeScVal(
              xdr.ScVal.fromXDR(firstParam.value, "base64")
            );
            if (typeof decoded === "string") {
              return decoded;
            }
          } catch (error) {
            // Ignore decoding errors
          }
        }
      }

      return "unknown";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Extract function arguments from operation
   */
  private extractFunctionArgs(operation: any): any[] {
    try {
      if (!operation.parameters || !Array.isArray(operation.parameters)) {
        return [];
      }

      return operation.parameters
        .map((param: any) => {
          if (param && param.value) {
            try {
              return this.decodeScVal(xdr.ScVal.fromXDR(param.value, "base64"));
            } catch (error) {
              this.logger.warn("Failed to decode parameter:", error);
              return undefined;
            }
          }
          return undefined;
        })
        .filter((arg: any) => arg !== undefined);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract contract ID from operation
   */
  private extractContractId(operation: any): string {
    try {
      // Try to extract from function field
      if (operation.function && operation.function.includes("invoke")) {
        // Look for contract ID in parameters
        if (operation.parameters && operation.parameters.length > 1) {
          const contractParam = operation.parameters[1]; // Usually second parameter
          if (contractParam && contractParam.value) {
            try {
              const decoded = this.decodeScVal(
                xdr.ScVal.fromXDR(contractParam.value, "base64")
              );
              if (typeof decoded === "string") {
                return decoded;
              }
            } catch (error) {
              // Ignore decoding errors
            }
          }
        }
      }

      return "unknown";
    } catch (error) {
      return "unknown";
    }
  }
}
