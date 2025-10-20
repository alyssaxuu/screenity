const webpack = require("webpack");
const path = require("path");
const fileSystem = require("fs-extra");
const env = require("./utils/env");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const ASSET_PATH = process.env.ASSET_PATH || "/";

require("dotenv").config();

// Entry points for the different pages
const entryPoints = {
  background: path.join(__dirname, "src", "pages", "Background", "index.js"),
  contentScript: path.join(__dirname, "src", "pages", "Content", "index.jsx"),
  recorder: path.join(__dirname, "src", "pages", "Recorder", "index.jsx"),
  cloudrecorder: path.join(
    __dirname,
    "src",
    "pages",
    "CloudRecorder",
    "index.jsx"
  ),
  recorderoffscreen: path.join(
    __dirname,
    "src",
    "pages",
    "RecorderOffscreen",
    "index.jsx"
  ),
  camera: path.join(__dirname, "src", "pages", "Camera", "index.jsx"),
  waveform: path.join(__dirname, "src", "pages", "Waveform", "index.jsx"),
  sandbox: path.join(__dirname, "src", "pages", "Sandbox", "index.jsx"),
  permissions: path.join(__dirname, "src", "pages", "Permissions", "index.jsx"),
  setup: path.join(__dirname, "src", "pages", "Setup", "index.jsx"),
  playground: path.join(__dirname, "src", "pages", "Playground", "index.jsx"),
  editor: path.join(__dirname, "src", "pages", "Editor", "index.jsx"),
  region: path.join(__dirname, "src", "pages", "Region", "index.jsx"),
  download: path.join(__dirname, "src", "pages", "Download", "index.jsx"),
  editorfallback: path.join(
    __dirname,
    "src",
    "pages",
    "EditorFallback",
    "index.jsx"
  ),
  backup: path.join(__dirname, "src", "pages", "Backup", "index.jsx"),
};

const htmlPlugins = Object.keys(entryPoints)
  .map((entryName) => {
    // Skip background script as it doesn't need an HTML file
    if (entryName === "background" || entryName === "contentScript") {
      return null;
    }

    const templatePath = path.join(
      __dirname,
      "src",
      "pages",
      entryName.charAt(0).toUpperCase() + entryName.slice(1),
      "index.html"
    );

    const options = {
      template: templatePath,
      filename: `${entryName}.html`,
      chunks: [entryName],
      cache: false,
    };

    // Add favicon only for backup page
    if (entryName === "backup") {
      options.favicon = path.join(
        __dirname,
        "src",
        "assets",
        "backup-favicon.ico"
      );
    } else {
      options.favicon = path.join(__dirname, "src", "assets", "favicon.png");
    }

    return new HtmlWebpackPlugin(options);
  })
  .filter(Boolean); // Filter out null values

const fileExtensions = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "eot",
  "otf",
  "svg",
  "ttf",
  "woff",
  "woff2",
];

const secretsPath = path.join(__dirname, `secrets.${env.NODE_ENV}.js`);
const alias = { "react-dom": "@hot-loader/react-dom" };

if (fileSystem.existsSync(secretsPath)) {
  alias["secrets"] = secretsPath;
}

const config = {
  mode: process.env.NODE_ENV || "production",
  performance: { hints: false },
  entry: entryPoints,

  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "build"),
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        use: [
          { loader: "style-loader" },
          { loader: "css-loader" },
          {
            loader: "sass-loader",
            options: { sourceMap: true },
          },
        ],
      },
      {
        test: new RegExp(`.(${fileExtensions.join("|")})$`),
        type: "asset/resource",
        exclude: /node_modules/,
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(ts|tsx)$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(js|jsx)$/,
        use: [{ loader: "source-map-loader" }, { loader: "babel-loader" }],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    alias: {
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve("./node_modules/react/jsx-runtime"),
    },
    extensions: fileExtensions
      .map((extension) => `.${extension}`)
      .concat([".js", ".jsx", ".ts", ".tsx", ".css"]),
  },
  plugins: [
    new CleanWebpackPlugin({ verbose: false }),
    new webpack.ProgressPlugin(),
    new webpack.DefinePlugin({
      "process.env.SCREENITY_APP_BASE": JSON.stringify(
        process.env.SCREENITY_APP_BASE
      ),
      "process.env.SCREENITY_WEBSITE_BASE": JSON.stringify(
        process.env.SCREENITY_WEBSITE_BASE
      ),
      "process.env.SCREENITY_API_BASE_URL": JSON.stringify(
        process.env.SCREENITY_API_BASE_URL
      ),
      "process.env.SCREENITY_ENABLE_CLOUD_FEATURES": JSON.stringify(
        process.env.SCREENITY_ENABLE_CLOUD_FEATURES
      ),
      "process.env.MAX_RECORDING_DURATION": JSON.stringify(
        process.env.MAX_RECORDING_DURATION || 3600 // Default to 1 hour
      ),
      "process.env.RECORDING_WARNING_THRESHOLD": JSON.stringify(
        process.env.RECORDING_WARNING_THRESHOLD || 60 // Default to 1 minute
      ),
    }),

    // Copy manifest and transform with package info
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/manifest.json",
          to: path.join(__dirname, "build"),
          force: true,
          transform: (content) => {
            return Buffer.from(
              JSON.stringify({
                description: process.env.npm_package_description,
                version: process.env.npm_package_version,
                ...JSON.parse(content.toString()),
              })
            );
          },
        },
        {
          from: "src/schema.json",
          to: path.join(__dirname, "build/schema.json"),
          force: true,
        },
        {
          from: "src/assets/",
          to: path.join(__dirname, "build/assets"),
          force: true,
        },
        {
          from: "src/_locales/",
          to: path.join(__dirname, "build/_locales"),
          force: true,
        },
      ],
    }),
    ...htmlPlugins,
  ],
};

if (env.NODE_ENV === "development") {
  config.devtool = "cheap-module-source-map";
} else {
  config.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  };
}

module.exports = config;
