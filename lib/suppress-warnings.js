/**
 * Suppresses known third-party deprecation warnings in Node 22/24+
 * specifically [DEP0169] url.parse() triggered by legacy Google Cloud / Firebase Admin SDKs.
 */
if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function (warning, ...args) {
    if (
      (typeof warning === "string" && (warning.includes("DEP0169") || warning.includes("url.parse()"))) ||
      (args[0] && (args[0] === "DEP0169" || args[0]?.code === "DEP0169")) ||
      (typeof warning === "object" && warning?.code === "DEP0169")
    ) {
      return;
    }
    return originalEmitWarning.apply(process, [warning, ...args]);
  };
}
