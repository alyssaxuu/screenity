import React, { useState, useEffect, useContext, useCallback } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

// Context
import { contentStateContext } from "../context/ContentState";

const Modal = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [title, setTitle] = useState("Test");
  const [description, setDescription] = useState("Description here");
  const [button1, setButton1] = useState("Submit");
  const [button2, setButton2] = useState("Cancel");
  // useState(() => fn) treats fn as a lazy initializer and stores its return,
  // so a callback default must return a function or it ends up undefined.
  const noop = () => {};
  const [trigger, setTrigger] = useState(() => noop);
  const [trigger2, setTrigger2] = useState(() => noop);
  const [showModal, setShowModal] = useState(false);
  const [image, setImage] = useState(null);
  const [learnmore, setLearnMore] = useState(null);
  const [learnMoreLink, setLearnMoreLink] = useState(null);
  const [colorSafe, setColorSafe] = useState(false);
  const [sideButton, setSideButton] = useState(false);
  const [sideButtonAction, setSideButtonAction] = useState(() => noop);

  const openModal = useCallback(
    (
      title,
      description,
      button1,
      button2,
      action,
      action2,
      image = null,
      learnMore = null,
      learnMoreLink = null,
      colorSafe = false,
      sideButton = false,
      sideButtonAction = () => {}
    ) => {
      setTitle(title);
      setDescription(description);
      setButton1(button1);
      setButton2(button2);
      setShowModal(true);
      setTrigger(() => (typeof action === "function" ? action : noop));
      setTrigger2(() => (typeof action2 === "function" ? action2 : noop));
      setImage(image);
      setLearnMore(learnMore);
      setLearnMoreLink(learnMoreLink);
      setColorSafe(colorSafe);
      setSideButton(sideButton);
      setSideButtonAction(() =>
        typeof sideButtonAction === "function" ? sideButtonAction : noop,
      );
    }
  );

  useEffect(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      openModal: openModal,
    }));

    return () => {
      setContentState((prevContentState) => ({
        ...prevContentState,
        openModal: null,
      }));
    };
  }, []);

  return (
    <AlertDialog.Root
      open={showModal}
      modal={false}
      onOpenChange={(open) => {
        setShowModal(open);
      }}
    >
      <AlertDialog.Trigger asChild />
      <AlertDialog.Portal
        container={props.shadowRef.current.shadowRoot.querySelector(
          ".container"
        )}
      >
        <div className="AlertDialogOverlay"></div>
        <AlertDialog.Content
          className="AlertDialogContent"
          onEscapeKeyDown={() => {
            // Escape == the cancel/secondary action. For modals that pause the
            // recording while open (restart/discard confirm), this resumes it
            // instead of leaving it stuck paused with the modal gone.
            trigger2();
          }}
        >
          <AlertDialog.Title className="AlertDialogTitle">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="AlertDialogDescription">
            {description.split("\n").map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                <br />
              </React.Fragment>
            ))}
            {learnmore && (
              <>
                {" "}
                <a href={learnMoreLink} target="_blank">
                  {learnmore}
                </a>
              </>
            )}
          </AlertDialog.Description>
          {image && (
            <img
              src={image}
              style={{
                width: "100%",
                marginBottom: 15,
                marginTop: 5,
                borderRadius: "15px",
              }}
            />
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            {sideButton && (
              <button
                className="SideButtonModal"
                onClick={() => {
                  sideButtonAction();
                  setShowModal(false);
                }}
              >
                {sideButton}
              </button>
            )}
            {button2 && (
              <AlertDialog.Cancel asChild>
                <button className="Button grey" onClick={() => trigger2()}>
                  {button2}
                </button>
              </AlertDialog.Cancel>
            )}
            {button1 && (
              <AlertDialog.Action asChild>
                <button
                  className={!colorSafe ? "Button red" : "Button blue"}
                  onClick={() => trigger()}
                >
                  {button1}
                </button>
              </AlertDialog.Action>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default Modal;
