module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          "http": require.resolve("stream-http"),
          "https": require.resolve("https-browserify"),
          "stream": require.resolve("stream-browserify"),
          "crypto": require.resolve("crypto-browserify"),
          "url": require.resolve("url/"),
          "assert": require.resolve("assert/"),
          "util": require.resolve("util/"),
          "zlib": require.resolve("browserify-zlib")
        }
      }
    }
  }
}; 