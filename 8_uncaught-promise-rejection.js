async function noAwaitInTryCatch() {
  try {
    return Promise.reject(new Error("test"));
  } catch (error) {
    console.log(`noAwaitInTryCatch: ${error}`);
  }
}

async function awaitInTryCatch() {
  try {
    return await Promise.reject(new Error("test"));
  } catch (error) {
    console.log(`awaitInTryCatch: ${error}`);
  }
}

function main() {
  // Uncomment this to see the unhandled rejection
  // process.on("unhandledRejection", (error) => {
  //   console.log(`unhandledRejection: ${error}`);
  // });
  awaitInTryCatch();
  noAwaitInTryCatch();
}

main();