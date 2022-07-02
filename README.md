# Screenity
![Demo](https://media.giphy.com/media/6hc709nFEYnEtzIIyN/giphy.gif)
<br>
The most powerful screen recorder & annotation tool for Chrome 🎥

[Get it now - it's free!](https://chrome.google.com/webstore/detail/screenity-screen-recorder/kbbdabhdfibnancpjfhlkhafgdilcnji)

Screenity is a feature-packed screen and camera recorder for Chrome. Annotate your screen to give feedback, emphasize your clicks, edit your recording, and much more.

> You can support this project (and many others) through [GitHub Sponsors](https://github.com/sponsors/alyssaxuu)! ❤️

Made by [Alyssa X](https://alyssax.com)

<a href="https://www.producthunt.com/posts/screenity?utm_source=badge-top-post-badge&utm_medium=badge&utm_souce=badge-screenity" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=275308&theme=light&period=daily" alt="Screenity - The most powerful screen recorder for Chrome | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
<a href="https://news.ycombinator.com/item?id=25150804" target="_blank"><img height=53 src="https://hackerbadge.now.sh/api?id=25150804&type=orange" alt="Featured on HackerNews"></a>

Also available for [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/screenity-screen-record/nbdkgeeeabnfegekngimpknhnkmocjcj)

## Table of contents
  - [Features](#features)
  - [Translating Screenity to other languages](#translating-screenity-to-other-languages)
  - [Self-hosting Screenity](#self-hosting-screenity)
  - [Libraries used](#libraries-used)

## Features
🎥 Make unlimited recordings of your tab, desktop, any application, and camera<br>
✏️ Annotate by drawing anywhere on the screen, adding text, and creating arrows<br>
👀 Highlight your clicks, focus on your mouse, or hide it from the recording<br>
🎙️ Individual microphone and computer audio controls, push to talk, and more<br>
⚙️ Custom countdowns, show controls only on hover, and many other customization options<br>
💾 Export as mp4, gif, and webm, or save the video directly to Google Drive<br>
✂️ Trim or remove sections of your recording<br>
🌐 Available in English, Catalan, Spanish (by [Carmen Madrazo](https://twitter.com/Carmen_M_A)), French (by [Marie](https://twitter.com/marie_dm_)), Portuguese, Brazilian Portuguese, German (by [Christian Heilmann](https://github.com/codepo8)), Korean (by [
Dong-Hyeon, Kim](https://github.com/blood72)), Chinese (by [xkonglong](https://github.com/xkonglong)), Polish (by [Damian Harateh](https://github.com/harad1)), Russian (by [Artem](https://github.com/blinovartem)), Tamil (by [MC Naveen](https://github.com/mcnaveen)), Turkish (by [Can Mavioğlu](https://github.com/canmavi)), Italian (by [Angelo](https://github.com/AngeloBottazzo)), Hindi (by [
Pranjal Aggarwal](https://github.com/pranjalagg)), and Indonesian (by [Galang Aprilian](https://github.com/GlgApr))<br>
...and much more - all for free & no sign in needed!<br>

[Here's a Google Sheet](https://docs.google.com/spreadsheets/d/1juc1zWC2QBxYqlhpDZZUNHl3P6Tens6YiChchFcEJVw/edit?usp=sharing) to compare Screenity's features with other free & premium screen recorders available for Chrome.

## Translating Screenity to other languages
If you'd like to translate Screenity to a new language, here's what you should do:

1. Make sure the language you want to translate Screenity into is supported by the Chrome Store. [Here's a list](https://developer.chrome.com/docs/webstore/i18n/#choosing-locales-to-support) of all the supported locales.
2. Create a new folder under [_locales](https://github.com/alyssaxuu/screenity/tree/master/_locales) with the [locale name for your language](https://developer.chrome.com/docs/webstore/i18n/#choosing-locales-to-support).
3. Make a copy of [this file](https://github.com/alyssaxuu/screenity/blob/master/_locales/en/messages.json) and translate the "message". The "description" shouldn't be translated, it's only there to give you some context where the string will show in the extension.
4. Translate the [Chrome Store description](https://chrome.google.com/webstore/detail/screenity-screen-recorder/kbbdabhdfibnancpjfhlkhafgdilcnji?hl=en&authuser=0) so it can be published there, you can simply make a comment with it when you make a pull request. [Here's an example](https://github.com/alyssaxuu/screenity/pull/39) of how that pull request should look like.

Before submitting the pull request, it would be helpful if you tried running the extension in the new language, to make sure everything looks right.

## Self-hosting Screenity
You can run Screenity locally without having to install it from the Chrome Store. Here's how:

1. Download the code. In the web version of GitHub, you can do that by clicking the green "Code" button, and then "Download ZIP".
2. Go to chrome://extensions/ in your browser, and [enable developer mode](https://developer.chrome.com/docs/extensions/mv2/faq/#:~:text=You%20can%20start%20by%20turning,a%20packaged%20extension%2C%20and%20more.).
3. Drag the folder that contains the code (make sure it's a folder and not a ZIP file, so unzip first), or click on the "Load unpacked" button and locate the folder.
4. That's it, you will now be able to use Screenity locally. Make sure you pin it on the toolbar by clicking the "puzzle" icon in the toolbar and pinning Screenity.
5. To enable the Google Drive Upload (authorization consent screen) you must change the client_id in the manifest.json file with your linked extension key. You can create it accessing Google Cloud [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)?project=your_project and selecting menu "Create Credential" > "OAuth Client ID >  Chrome App. To create an extension key, you can follow the steps [here](https://developer.chrome.com/docs/extensions/mv3/manifest/key/). After these steps, reload your Extension Folder in Extensions (Developer Mode).

## Libraries used

- [jQuery](https://jquery.com/) -  for better event handling and DOM manipulation
- [FabricJs](http://fabricjs.com/) -  for interactive text and arrows (optimized custom build)
- [FFMPEG](https://www.ffmpeg.org/) - to convert the video to GIF or MP4
- [Jquery Nice Select](https://hernansartorio.com/jquery-nice-select/) - for better, more stylish dropdowns
- [Nouislider](https://github.com/leongersen/noUiSlider) -  for the range sliders used for trimming / removing parts of the recording
- [Pickr](https://github.com/Simonwep/pickr) - for the color picker
- [Plyr](https://github.com/sampotts/plyr) - for the video player shown when editing the recording
- [StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js) - for saving the video asynchronously while recording
- [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration) - for making the downloaded videos seekable

#
 Feel free to reach out to me through email at hi@alyssax.com or [on Twitter](https://twitter.com/alyssaxuu) if you have any questions or feedback! Hope you find this useful 💜
