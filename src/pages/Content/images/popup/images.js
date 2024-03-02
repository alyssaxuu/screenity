// I need to make this work for a Chrome extension, so I can't import images, instead it needs to be a string with the path to the image
const URL =
  "chrome-extension://" + chrome.i18n.getMessage("@@extension_id") + "/assets";

const DropdownIcon = `${URL}/dropdown.svg`;
const MicOnIcon = `${URL}/mic-on.svg`;
const MicOffIcon = `${URL}/mic-off.svg`;
const CameraOnIcon = `${URL}/camera-on.svg`;
const CameraOffIcon = `${URL}/camera-off.svg`;
const CheckWhiteIcon = `${URL}/check-white.svg`;
const Waveform = `${URL}/waveform.svg`;
const RecordTabActive = `${URL}/record-tab-active.svg`;
const RecordTabInactive = `${URL}/record-tab-inactive.svg`;
const VideoTabActive = `${URL}/video-tab-active.svg`;
const VideoTabInactive = `${URL}/video-tab-inactive.svg`;
const ScreenTabOn = `${URL}/screen-tab-on.svg`;
const ScreenTabOff = `${URL}/screen-tab-off.svg`;
const RegionTabOn = `${URL}/region-tab-on.svg`;
const RegionTabOff = `${URL}/region-tab-off.svg`;
const AudioTabOn = `${URL}/audio-tab-on.svg`;
const AudioTabOff = `${URL}/audio-tab-off.svg`;
const MockupTabOn = `${URL}/mockup-tab-on.svg`;
const MockupTabOff = `${URL}/mockup-tab-off.svg`;
const TempLogo = `${URL}/temp-logo.png`;
const TempFigma = `${URL}/temp/figma.webp`;
const TempTwitter = `${URL}/temp/twitter.webp`;
const TempDesignSystem = `${URL}/temp/designsystem.webp`;
const TempMarketing = `${URL}/temp/marketing.webp`;
const TempSubstack = `${URL}/temp/substack.webp`;
const CopyLinkIcon = `${URL}/copy-link.svg`;
const MoreActionsIcon = `${URL}/more-actions.svg`;
const ProfilePic = `${URL}/pfp.png`;
const HandleControl = `${URL}/canvas/handle.png`;
const RotateControl = `${URL}/canvas/rotate.png`;
const MiddleHandleControl = `${URL}/canvas/middle-handle.png`;
const MiddleHandleControlV = `${URL}/canvas/middle-handle-v.png`;
const DefaultCursor = `${URL}/cursors/default.svg`;
const CameraTabIconOn = `${URL}/camera-tab-icon-on.svg`;
const CameraTabIconOff = `${URL}/camera-tab-icon-off.svg`;
const CameraOffBlue = `${URL}/camera-off-blue.svg`;
const MicOffBlue = `${URL}/mic-off-blue.svg`;
const DropdownGroup = `${URL}/dropdown-group.svg`;

export {
  DropdownIcon,
  MicOnIcon,
  MicOffIcon,
  CameraOnIcon,
  CameraOffIcon,
  CheckWhiteIcon,
  Waveform,
  RecordTabActive,
  RecordTabInactive,
  VideoTabActive,
  VideoTabInactive,
  ScreenTabOn,
  ScreenTabOff,
  RegionTabOn,
  RegionTabOff,
  AudioTabOn,
  AudioTabOff,
  MockupTabOn,
  MockupTabOff,
  TempLogo,
  TempFigma,
  TempTwitter,
  TempDesignSystem,
  TempMarketing,
  TempSubstack,
  CopyLinkIcon,
  MoreActionsIcon,
  ProfilePic,
  HandleControl,
  RotateControl,
  MiddleHandleControl,
  MiddleHandleControlV,
  DefaultCursor,
  CameraTabIconOn,
  CameraTabIconOff,
  CameraOffBlue,
  MicOffBlue,
  DropdownGroup,
};
