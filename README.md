# Screenity / Slingui Recording

This is the recording module used by Slingui, forked from Screenity's recording engine.


> _✨ Screenity's open source work is sponsored by_
> ### Recall.ai - API for desktop recording [<img src="https://github.com/user-attachments/assets/eee643f1-1b64-4d14-bb04-498c321fd937" align="right">](https://www.recall.ai/product/desktop-recording-sdk?utm_source=github&utm_medium=sponsorship&utm_campaign=alyssaxuu-screenity)
>
> If you’re looking for a hosted desktop recording API, consider checking out [Recall.ai](https://www.recall.ai/product/desktop-recording-sdk?utm_source=github&utm_medium=sponsorship&utm_campaign=alyssaxuu-screenity), an API that records Zoom, Google Meet, Microsoft Teams, in-person meetings, and more.

[![jiewjjc232](https://github.com/alyssaxuu/screenity/assets/7581348/ed55e52e-4adf-442b-b774-6856abacdffb)](https://screenity.io)

The free and privacy-friendly screen recorder with no limits 🎥

[Get it now - it's free!](https://chrome.google.com/webstore/detail/screenity-screen-recorder/kbbdabhdfibnancpjfhlkhafgdilcnji)

Screenity is a powerful, privacy-friendly screen recorder and annotation tool for creating better videos for work, education, and more. You can create stunning product demos, tutorials, presentations, or share feedback with your team — all for free.

<a href="https://www.producthunt.com/posts/screenity?utm_source=badge-top-post-badge&utm_medium=badge&utm_source=badge-screenity" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=275308&theme=light&period=daily" alt="Slingui - The most powerful screen recorder for Chrome | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
<a href="https://news.ycombinator.com/item?id=25150804" target="_blank"><img height=53 src="https://hackerbadge.now.sh/api?id=25150804&type=orange" alt="Featured on HackerNews"></a>

> Want to support the project (and the solo developer behind it)?  
>
> Check out [**Screenity Pro**](https://screenity.io/pro): a privacy-friendly, EU-hosted platform with link sharing, multi-scene editing, zoom keyframes, captions, and more ❤️  

Made by [Alyssa X](https://alyssax.com)

## Table of contents
- [Screenity](#screenity-slingui-recording)
- [Table of contents](#table-of-contents)
- [Features](#features)
- [Self-hosting Screenity](#self-hosting-screenity)
- [Creating a development version](#creating-a-development-version)
  - [Enabling Save to Google Drive](#enabling-save-to-google-drive)
- [Acknowledgements](#acknowledgements)

## Features

🎥 Make unlimited recordings of your tab, a specific area, desktop, any application, or camera<br>
🎙️ Record your microphone or internal audio, and use features like push-to-talk<br>
✏️ Annotate by drawing anywhere on the screen, adding text, arrows, shapes, and more<br>
✨ Use AI-powered camera backgrounds or blur to enhance your recordings<br>
🔎 Zoom in smoothly in your recordings to focus on specific areas<br>
🪄 Blur out any sensitive content of any page to keep it private<br>
✂️ Remove or add audio, cut, trim, or crop your recordings with a comprehensive editor<br>
👀 Highlight your clicks and cursor, and go in spotlight mode<br>
⏱️ Set up alarms to automatically stop your recording<br>
💾 Export as MP4, GIF, or WebM, or save the video directly to Google Drive and share a link<br>
⚙️ Set a countdown, hide parts of the UI, or move it anywhere<br>
🔒 Only you can see your videos, we don’t collect any of your data. You can even go offline!<br>
💙 No limits: make as many videos as you want, for as long as you want<br> …and much more — all for free, with no sign-in needed!

## Self-hosting Screenity

> 🛠️ **Note:** When self-hosted, the extension runs entirely in local-only mode with no API calls, sign-in flows, or platform features. Nothing is sent anywhere. While some internal code paths reference [Screenity Pro](https://screenity.io/pro), these features are only active in the official Chrome Store version.

You can run Screenity locally without installing it from the Chrome Store. Here's how:

1. Download the latest `Build.zip` from the [releases page](https://github.com/alyssaxuu/screenity/releases).
2. Open `chrome://extensions/` in your browser and [enable Developer mode](https://developer.chrome.com/docs/extensions/mv2/faq/#:~:text=You%20can%20start%20by%20turning,a%20packaged%20extension%2C%20and%20more.).
3. Drag the unzipped folder containing the code into the page, or click **Load unpacked** and select the folder manually.
4. That's it — you should now be able to use Screenity locally. [Follow these instructions](#enabling-save-to-google-drive) to set up the Google Drive integration.

<small>Self-hosting is totally fine for personal, educational, or internal use.
If you’re thinking about building a commercial product from this, feel free to [reach out](mailto:alyssa@screenity.io) — I’m open to chatting 💜</small>

## Creating a development version

> ❗️ **Important:** The license has changed to [GPLv3](https://github.com/alyssaxuu/screenity/blob/master/LICENSE) for the MV3 version (Screenity 3.0.0+). Please review the [Terms of Service](https://screenity.io/en/terms/) regarding intellectual property rights before using this code commercially.

1. Check that your [Node.js](https://nodejs.org/) version is **14** or higher.
2. Clone this repository.
3. Run `npm install` to install dependencies.
4. Run `npm start` to start the development server.
5. Open `chrome://extensions/` and [enable developer mode](https://developer.chrome.com/docs/extensions/mv2/faq/#:~:text=You%20can%20start%20by%20turning,a%20packaged%20extension%2C%20and%20more.).
6. Click **Load unpacked** and select the `build` folder.
7. The extension is now available locally. After making code changes, run `npm run build` to rebuild.

### Enabling Save to Google Drive

To enable Google Drive uploads, update the `client_id` in `manifest.json` with your extension's key. 

Create a new credential via [Google Cloud Console](https://console.cloud.google.com/apis/credentials): **Create Credential > OAuth Client ID > Chrome App**. For a persistent extension key, follow [these steps](https://developer.chrome.com/docs/extensions/reference/manifest/key).

## Acknowledgements

- Thanks to [HelpKit](https://www.helpkit.so/) for sponsoring this project by hosting the [Screenity Help Center](https://help.screenity.io/).
- Thanks to [Mei Xuan](https://www.behance.net/meixuanloo) for helping with the Chinese translation of the extension.

If you need any help, or want to become a Screenity expert, you can browse articles and guides in the [help center](https://help.screenity.io). You can also submit any feedback or ideas in this [form](https://tally.so/r/3ElpXq), or contact through [this page](https://help.screenity.io/contact)
