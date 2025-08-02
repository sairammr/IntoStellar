import { NextRequest, NextResponse } from 'next/server';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount');
    const fromAddress = searchParams.get('fromAddress') || '0x0000000000000000000000000000000000000000';

    if (!amount) {
      return NextResponse.json(
        { error: 'Amount parameter is required' },
        { status: 400 }
      );
    }


    try {
      const coinGeckoResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,stellar&vs_currencies=usd'
      );

      if (!coinGeckoResponse.ok) {
        console.error('CoinGecko API error:', coinGeckoResponse.status);
        throw new Error(`Failed to fetch prices: ${coinGeckoResponse.status}`);
      }

      const priceData = await coinGeckoResponse.json();
      const ethPriceUSD = priceData.ethereum.usd;
      const xlmPriceUSD = priceData.stellar.usd;
      
      // Calculate ETH to XLM conversion rate
      const ethToXlmRate = (ethPriceUSD / xlmPriceUSD).toFixed(2);
      
      const ethAmount = parseFloat(amount);
      const xlmAmount = (ethAmount * parseFloat(ethToXlmRate)).toFixed(2);
      
      // Estimate gas (typical ETH transfer)
      const gasEstimate = 0.005;

      return NextResponse.json({
        success: true,
        data: {
          fromAmount: amount,
          toAmount: xlmAmount,
          rate: ethToXlmRate,
          gasEstimate: gasEstimate,
          ethPriceUSD: ethPriceUSD,
          xlmPriceUSD: xlmPriceUSD,
          source: 'CoinGecko API'
        }
      });
    } catch (error) {
      console.error('Error fetching prices:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch prices',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching 1inch quote:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch conversion rate',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 