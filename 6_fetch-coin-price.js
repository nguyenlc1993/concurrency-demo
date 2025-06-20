import pThrottle from "p-throttle";
import fs from "fs/promises";

const BITGET_BASE_URL = "https://api.bitget.com";
const requestStats = {
  totalRequestCount: 0,
  totalRequestTime: 0,
};

/**
 * Make a request to the API
 * @param {string} url - The URL to request
 * @param {RequestInit} options - The options for the request
 * @returns {Promise<any>} The response from the API
 */
async function request(url, options) {
  const startTime = Date.now();
  const response = await fetch(url, options);
  const endTime = Date.now();
  requestStats.totalRequestCount++;
  requestStats.totalRequestTime += endTime - startTime;
  return await response.json();
}

/**
 * Fetch the first 100 USDT pairs
 * @returns {Promise<{coin: string, symbol: string}[]>} The first 100 USDT pairs.
 */
async function fetchFirst100UsdtPairs() {
  const data = await request(`${BITGET_BASE_URL}/api/v2/spot/public/symbols`);
  if (data.code !== "00000") {
    throw new Error(data.msg);
  }
  return data.data
    .filter((item) => item.quoteCoin === "USDT" && item.status === "online")
    .sort((item1, item2) => item1.baseCoin.localeCompare(item2.baseCoin))
    .slice(0, 100)
    .map((item) => ({
      coin: item.baseCoin,
      symbol: item.symbol,
    }));
}

/**
 * Fetch the price of a coin
 * @param {string} symbol - The symbol of the coin
 * @param {AbortSignal | undefined} signal - The signal to abort the request (optional)
 * @returns {Promise<number>} The price of the coin
 */
async function fetchCoinPrice(symbol, signal) {
  const data = await request(
    `${BITGET_BASE_URL}/api/v2/spot/market/tickers?symbol=${symbol}`,
    {
      signal,
    }
  );
  if (data.code !== "00000") {
    throw new Error(data.msg);
  }
  const price = data.data[0]?.lastPr;
  if (!price) {
    throw new Error(`No price found for ${symbol}`);
  }
  console.log(`Fetched ${symbol} price: ${price}`);
  return price;
}

/**
 * Fetch the prices of the coins sequentially
 * @param {AbortSignal | undefined} signal - The signal to abort the request (optional)
 * @returns {Promise<{coin: string, usdtPrice: number}[]>} The prices of the coins
 */
async function fetchCoinPricesSequentially(signal) {
  const tradingList = await fetchFirst100UsdtPairs();
  const coinPrices = [];
  for (const { coin, symbol } of tradingList) {
    if (signal?.aborted) {
      break;
    }
    try {
      const usdtPrice = await fetchCoinPrice(symbol, signal);
      coinPrices.push({ coin, usdtPrice });
    } catch (error) {
      console.log(`Skipped ${symbol}: ${error.message}`);
    }
  }
  return coinPrices;
}

/**
 * Fetch the prices of the coins concurrently
 * @param {AbortSignal | undefined} signal - The signal to abort the request (optional)
 * @returns {Promise<{coin: string, usdtPrice: number}[]>} The prices of the coins
 */
async function fetchCoinPricesConcurrently(signal) {
  const tradingList = await fetchFirst100UsdtPairs();
  const allResults = await Promise.allSettled(
    tradingList.map((item) => fetchCoinPrice(item.symbol, signal))
  );
  const coinPrices = [];
  for (const [index, result] of allResults.entries()) {
    const { coin, symbol } = tradingList[index];
    if (result.status === "fulfilled") {
      coinPrices.push({ coin, usdtPrice: result.value });
    } else {
      console.log(`Skipped ${symbol}: ${result.reason.message}`);
    }
  }
  return coinPrices;
}

/**
 * Fetch the prices of the coins throttled
 * @param {AbortSignal | undefined} signal - The signal to abort the request (optional)
 * @returns {Promise<{coin: string, usdtPrice: number}[]>} The prices of the coins
 */
async function fetchCoinPricesThrottled(signal) {
  const tradingList = await fetchFirst100UsdtPairs();
  const throttler = pThrottle({
    limit: 20,
    interval: 1000,
  });
  const throttledFetchCoinPrice = throttler(fetchCoinPrice);
  const allResults = await Promise.allSettled(
    tradingList.map((item) => throttledFetchCoinPrice(item.symbol, signal))
  );
  const coinPrices = [];
  for (const [index, result] of allResults.entries()) {
    const { coin, symbol } = tradingList[index];
    if (result.status === "fulfilled") {
      coinPrices.push({ coin, usdtPrice: result.value });
    } else {
      console.log(`Skipped ${symbol}: ${result.reason.message}`);
    }
  }
  return coinPrices;
}

async function main() {
  const controller = new AbortController();
  process.on("SIGINT", () => {
    controller.abort();
    console.log("Aborted");
  });
  const startTime = Date.now();
  const coinPrices = await fetchCoinPricesThrottled(controller.signal);
  const endTime = Date.now();
  console.log(`Total time taken: ${endTime - startTime}ms`);
  console.log(
    `Average request time: ${
      requestStats.totalRequestTime / requestStats.totalRequestCount
    }ms`
  );
  await fs.writeFile("coin-prices.json", JSON.stringify(coinPrices, null, 2));
}

main();
