module.exports = {
  // other webpack config settings
  devServer: {
    setupMiddlewares: (middlewares, devServer) => {
      // Your custom middleware setup logic here if needed
      return middlewares;
    }
  }
};