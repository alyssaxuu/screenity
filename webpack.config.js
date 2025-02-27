var webpack = require("webpack"),
  path = require("path"),
  fileSystem = require("fs-extra"),
  env = require("./utils/env"),
  CopyWebpackPlugin = require("copy-webpack-plugin"),
  HtmlWebpackPlugin = require("html-webpack-plugin"),
  TerserPlugin = require("terser-webpack-plugin");
var { CleanWebpackPlugin } = require("clean-webpack-plugin");

const ASSET_PATH = process.env.ASSET_PATH || "/";

var alias = {
  "react-dom": "@hot-loader/react-dom",
};

// load the secrets
var secretsPath = path.join(__dirname, "secrets." + env.NODE_ENV + ".js");

var fileExtensions = [
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

if (fileSystem.existsSync(secretsPath)) {
  alias["secrets"] = secretsPath;
}

var options = {
  mode: process.env.NODE_ENV || "production",
  performance: {
    hints: false,
  },
  entry: {
    background: path.join(__dirname, "src", "pages", "Background", "index.js"),
    contentScript: path.join(__dirname, "src", "pages", "Content", "index.jsx"),
    recorder: path.join(__dirname, "src", "pages", "Recorder", "index.jsx"),
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
    permissions: path.join(
      __dirname,
      "src",
      "pages",
      "Permissions",
      "index.jsx"
    ),
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
  },

  custom: {
    notHMR: ["background", "contentScript", "devtools", "sandbox"],
    enableBackgroundAutoReload: true,
    enableContentScriptsAutoReload: true,
  },
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "build"),
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        // look for .css or .scss files
        test: /\.(css|scss)$/,
        // in the `src` directory
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: new RegExp(".(" + fileExtensions.join("|") + ")$"),
        type: "asset/resource",
        exclude: /node_modules/,
        // loader: 'file-loader',
        // options: {
        //   name: '[name].[ext]',
        // },
      },
      {
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/,
      },
      { test: /\.(ts|tsx)$/, loader: "ts-loader", exclude: /node_modules/ },
      {
        test: /\.(js|jsx)$/,
        use: [
          {
            loader: "source-map-loader",
          },
          {
            loader: "babel-loader",
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    alias: alias,
    extensions: fileExtensions
      .map((extension) => "." + extension)
      .concat([".js", ".jsx", ".ts", ".tsx", ".css"]),
  },
  plugins: [
    new CleanWebpackPlugin({ verbose: false }),
    new webpack.ProgressPlugin(),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/manifest.json",
          to: path.join(__dirname, "build"),
          force: true,
          transform: function (content, path) {
            // generates the manifest file using the package.json informations
            return Buffer.from(
              JSON.stringify({
                description: process.env.npm_package_description,
                version: process.env.npm_package_version,
                ...JSON.parse(content.toString()),
              })
            );
          },
        },
      ],
    }),
    /*
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/assets/img/icon-128.png",
          to: path.join(__dirname, "build"),
          force: true,
        },
      ],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/assets/img/icon-34.png",
          to: path.join(__dirname, "build"),
          force: true,
        },
      ],
    }),
		*/
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/assets/",
          to: path.join(__dirname, "build/assets"),
          force: true,
        },
      ],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/_locales/",
          to: path.join(__dirname, "build/_locales"),
          force: true,
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Recorder", "index.html"),
      filename: "recorder.html",
      chunks: ["recorder"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(
        __dirname,
        "src",
        "pages",
        "RecorderOffscreen",
        "index.html"
      ),
      filename: "recorderoffscreen.html",
      chunks: ["recorderoffscreen"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Camera", "index.html"),
      filename: "camera.html",
      chunks: ["camera"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(
        __dirname,
        "src",
        "pages",
        "Permissions",
        "index.html"
      ),
      filename: "permissions.html",
      chunks: ["permissions"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Waveform", "index.html"),
      filename: "waveform.html",
      chunks: ["waveform"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Sandbox", "index.html"),
      filename: "sandbox.html",
      chunks: ["sandbox"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Setup", "index.html"),
      filename: "setup.html",
      chunks: ["setup"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(
        __dirname,
        "src",
        "pages",
        "Playground",
        "index.html"
      ),
      filename: "playground.html",
      chunks: ["playground"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Editor", "index.html"),
      filename: "editor.html",
      chunks: ["editor"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Region", "index.html"),
      filename: "region.html",
      chunks: ["region"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Download", "index.html"),
      filename: "download.html",
      chunks: ["download"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(
        __dirname,
        "src",
        "pages",
        "EditorFallback",
        "index.html"
      ),
      filename: "editorfallback.html",
      chunks: ["editorfallback"],
      cache: false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "src", "pages", "Backup", "index.html"),
      filename: "backup.html",
      chunks: ["backup"],
      cache: false,
      favicon: path.join(__dirname, "src", "assets", "backup-favicon.ico"),
    }),
  ],
};

if (env.NODE_ENV === "development") {
  options.devtool = "cheap-module-source-map";
} else {
  options.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  };
}

module.exports = options;
