import React from "react";
import { ReactSVG } from "react-svg";

const URL =
  "chrome-extension://" + chrome.i18n.getMessage("@@extension_id") + "/assets/";

const GrabIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/grab-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};
/*

*/

// Convert all to ReactSVG

const StopIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/stop-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const DrawIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/draw-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const PauseIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/pause-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const ResumeIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/resume-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CursorIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/cursor-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CommentIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/comment-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const MicIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/mic-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const MoreIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/more-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const RestartIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/restart-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const DiscardIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/discard-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const EyeDropperIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/eyedropper-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const Stroke1Icon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/stroke-1-icon.svg"}
      width={props.width}
      height={props.height}
      className={props.className}
      style={{
        textAlign: "center",
        margin: "auto",
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
};

const Stroke2Icon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/stroke-2-icon.svg"}
      width={props.width}
      height={props.height}
      className={props.className}
      style={{
        textAlign: "center",
        margin: "auto",
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
};

const Stroke3Icon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/stroke-3-icon.svg"}
      width={props.width}
      height={props.height}
      className={props.className}
      style={{
        textAlign: "center",
        margin: "auto",
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
};

const TargetCursorIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/target-cursor-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const HighlightCursorIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/highlight-cursor-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const HideCursorIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/hide-cursor-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const TextIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/text-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const ArrowIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/arrow-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const EraserIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/eraser-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const PenIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/pen-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const ShapeIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/shape-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const SelectIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/select-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const UndoIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/undo-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const RedoIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/redo-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const ImageIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/image-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const TransformIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/transform-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const HighlighterIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/highlighter-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const RectangleIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/rectangle-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CircleIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/circle-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const TriangleIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/triangle-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const RectangleFilledIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/rectangle-filled-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CircleFilledIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/circle-filled-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const TriangleFilledIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/triangle-filled-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const TrashIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/trash-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const VideoOffIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "camera-icons/video-off.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CameraCloseIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "camera-icons/close.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CameraMoreIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "camera-icons/more.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CameraResizeIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "camera-icons/camera-resize.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CameraIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/camera-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const BlurIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/blur-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const AlertIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/alert-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const TimeIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/time-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};
const SpotlightCursorIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "tool-icons/spotlight-cursor-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const Pip = (props) => {
  return (
    <ReactSVG
      src={URL + "camera-icons/pip.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CloseIconPopup = (props) => {
  return (
    <ReactSVG
      src={URL + "close-icon-popup.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const GrabIconPopup = (props) => {
  return (
    <ReactSVG
      src={URL + "grab-icon-popup.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const MoreIconPopup = (props) => {
  return (
    <ReactSVG
      src={URL + "more-icon-popup.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const OnboardingArrow = (props) => {
  return (
    <ReactSVG
      src={URL + "/helper/onboarding-arrow.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const NoInternet = (props) => {
  return (
    <ReactSVG
      src={URL + "/editor/icons/no-internet.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const CloseButtonToolbar = (props) => {
  return (
    <ReactSVG
      src={URL + "/tool-icons/close-button.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const HelpIconPopup = (props) => {
  return (
    <ReactSVG
      src={URL + "/tool-icons/help-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const AudioIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "/tool-icons/audio-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

const NotSupportedIcon = (props) => {
  return (
    <ReactSVG
      src={URL + "/tool-icons/not-supported-icon.svg"}
      width={props.width}
      height={props.height}
    />
  );
};

export {
  GrabIcon,
  StopIcon,
  DrawIcon,
  PauseIcon,
  ResumeIcon,
  CursorIcon,
  CommentIcon,
  MicIcon,
  MoreIcon,
  RestartIcon,
  DiscardIcon,
  EyeDropperIcon,
  Stroke1Icon,
  Stroke2Icon,
  Stroke3Icon,
  TargetCursorIcon,
  HighlightCursorIcon,
  HideCursorIcon,
  TextIcon,
  ArrowIcon,
  EraserIcon,
  PenIcon,
  ShapeIcon,
  SelectIcon,
  UndoIcon,
  RedoIcon,
  ImageIcon,
  TransformIcon,
  HighlighterIcon,
  RectangleIcon,
  CircleIcon,
  TriangleIcon,
  RectangleFilledIcon,
  CircleFilledIcon,
  TriangleFilledIcon,
  TrashIcon,
  VideoOffIcon,
  CameraCloseIcon,
  CameraMoreIcon,
  CameraResizeIcon,
  CameraIcon,
  BlurIcon,
  AlertIcon,
  TimeIcon,
  SpotlightCursorIcon,
  Pip,
  CloseIconPopup,
  GrabIconPopup,
  OnboardingArrow,
  NoInternet,
  CloseButtonToolbar,
  HelpIconPopup,
  MoreIconPopup,
  AudioIcon,
  NotSupportedIcon,
};
