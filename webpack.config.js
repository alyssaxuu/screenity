const webpack = require("webpack");
const path = require("path");
const fileSystem = require("fs-extra");
const env = require("./utils/env");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

const isDev = env.NODE_ENV === "development";

const ASSET_PATH = process.env.ASSET_PATH || "/";

if (process.env.SCREENITY_SKIP_ENV) {
  // open-source release build, no dotenv
} else if (isDev) {
  require("dotenv").config({ path: ".env.local" });
} else {
  require("dotenv").config({ path: ".env.production" });
}

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
  offscreenrecorder: path.join(
    __dirname,
    "src",
    "pages",
    "OffscreenRecorder",
    "index.jsx"
  ),
  audiooffscreen: path.join(
    __dirname,
    "src",
    "pages",
    "AudioOffscreen",
    "index.js"
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
  editorwebcodecs: path.join(
    __dirname,
    "src",
    "pages",
    "EditorWebCodecs",
    "index.jsx"
  ),
  editorviewer: path.join(
    __dirname,
    "src",
    "pages",
    "EditorViewer",
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

    // Map entry names to folder names (for multi-word entries)
    const folderNameMap = {
      cloudrecorder: "CloudRecorder",
      offscreenrecorder: "OffscreenRecorder",
      audiooffscreen: "AudioOffscreen",
      editorwebcodecs: "EditorWebCodecs",
      editorviewer: "EditorViewer",
    };

    const folderName =
      folderNameMap[entryName] ||
      entryName.charAt(0).toUpperCase() + entryName.slice(1);

    const templatePath = path.join(
      __dirname,
      "src",
      "pages",
      folderName,
      "index.html"
    );

    const options = {
      template: templatePath,
      filename: `${entryName}.html`,
      chunks: [entryName],
      cache: true,
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

  // Persistent filesystem cache for fast rebuilds
  cache: {
    type: "filesystem",
    buildDependencies: {
      config: [__filename],
    },
  },

  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "build"),
    clean: !isDev, // Only wipe build dir in production; dev keeps it to avoid re-copying 40MB of assets
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
        options: {
          transpileOnly: isDev,
        },
      },
      {
        test: /\.(js|jsx)$/,
        use: isDev
          ? [{ loader: "babel-loader" }]
          : [{ loader: "source-map-loader" }, { loader: "babel-loader" }],
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
    // Code extensions first — image/font extensions are only needed for explicit imports with extensions
    extensions: [".js", ".jsx", ".ts", ".tsx", ".css"],
  },
  plugins: [
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
      "process.env.SCREENITY_DEV_MODE": JSON.stringify(
        process.env.SCREENITY_DEV_MODE || ""
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
            const manifest = {
              description: process.env.npm_package_description,
              version: process.env.npm_package_version,
              ...JSON.parse(content.toString()),
            };

            // Strip dev-only origins from production builds.
            if (!isDev && manifest.externally_connectable?.matches) {
              manifest.externally_connectable.matches =
                manifest.externally_connectable.matches.filter(
                  (m) =>
                    !m.includes("localhost") && !m.includes("127.0.0.1"),
                );
            }

            return Buffer.from(JSON.stringify(manifest));
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

if (isDev) {
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
