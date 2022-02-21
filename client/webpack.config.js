const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const cssLoader = 'css-loader';

const postcssLoader = 'postcss-loader'/*  {
  loader: 'postcss-loader',
  options: {
    postcssOptions: {
      plugins: [
        [
          "autoprefixer",
          {
            // Options
          },
        ],
      ],
    },
  }
} */;

module.exports = function ({ production }) {
  return {
    mode: production ? 'production' : 'development',
    devtool: production ? undefined : 'inline-source-map',
    entry: './src/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'entry-bundle.js'
    },
    resolve: {
      extensions: ['.ts', '.js'],
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
      fallback: {
        'html-entities': require.resolve('html-entities/'),
        'events': require.resolve('events/'),
      },
    },
    devServer: {
      historyApiFallback: true,
      port: 9000,
    },
    module: {
      rules: [
        { test: /\.(png|gif|jpg|cur)$/i, loader: 'url-loader', options: { limit: 8192 } },
        { test: /\.woff2(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader', options: { limit: 10000, mimetype: 'application/font-woff2' } },
        { test: /\.woff(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'url-loader', options: { limit: 10000, mimetype: 'application/font-woff' } },
        { test: /\.(ttf|eot|svg|otf)(\?v=[0-9]\.[0-9]\.[0-9])?$/i, loader: 'file-loader' },
        { test: /\.css$/i, use: ['style-loader', cssLoader, postcssLoader] },
        { test: /\.ts$/i, use: ['ts-loader'], exclude: /node_modules/ },
        { test: /\.html$/i, loader: 'html-loader' },
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({ template: 'index.ejs' }),
    ]
  }
}
