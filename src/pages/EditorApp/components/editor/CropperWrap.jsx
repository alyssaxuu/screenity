import React, { useState, useEffect, useContext, useRef } from "react";
import { CropperRef, Cropper } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";

import { ContentStateContext } from "../../context/ContentState";

const CropperWrap = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);
  const [image, setImage] = useState(null);
  const cropperRef = useRef(null);
  // Guards against onChange firing during setCoordinates push: stale cropper
  // coords would otherwise overwrite state and revert CropUI inputs.
  const pushingToCropperRef = useRef(false);

  useEffect(() => {
    if (!cropperRef.current) return;
    if (!cropperRef.current.getCoordinates()) return;
    if (contentState.fromCropper) return;
    pushingToCropperRef.current = true;
    cropperRef.current.setCoordinates({
      top: contentState.top,
      left: contentState.left,
      width: contentState.width,
      height: contentState.height,
    });
    pushingToCropperRef.current = false;
    if (contentState.top != cropperRef.current.getCoordinates().top) {
      setContentState((prevState) => ({
        ...prevState,
        top: cropperRef.current.getCoordinates().top,
      }));
    }
    if (contentState.left != cropperRef.current.getCoordinates().left) {
      setContentState((prevState) => ({
        ...prevState,
        left: cropperRef.current.getCoordinates().left,
      }));
    }
    if (contentState.width != cropperRef.current.getCoordinates().width) {
      setContentState((prevState) => ({
        ...prevState,
        width: cropperRef.current.getCoordinates().width,
      }));
    }
    if (contentState.height != cropperRef.current.getCoordinates().height) {
      setContentState((prevState) => ({
        ...prevState,
        height: cropperRef.current.getCoordinates().height,
      }));
    }
  }, [
    contentState.width,
    contentState.height,
    contentState.top,
    contentState.left,
  ]);

  const onChange = (cropper) => {
    if (!cropper) return;
    if (pushingToCropperRef.current) return;
    setContentState((prevState) => ({
      ...prevState,
      top: cropper.getCoordinates().top,
      left: cropper.getCoordinates().left,
      width: cropper.getCoordinates().width,
      height: cropper.getCoordinates().height,
      fromCropper: true,
    }));
  };

  useEffect(() => {
    if (!contentState.blob) return;

    setImage(contentState.frame);
  }, [contentState.frame]);

  return (
    <div>
      <Cropper
        src={image}
        ref={cropperRef}
        onChange={onChange}
        className={"cropper"}
        stencilProps={{
          grid: true,
        }}
        defaultSize={{
          width: contentState.width || undefined,
          height: contentState.height || undefined,
        }}
        backgroundWrapperClassName="CropperBackgroundWrapper"
        width={contentState.width}
        height={contentState.height}
        transitions={false}
        style={{ transition: "none" }}
      />
    </div>
  );
};

export default CropperWrap;
