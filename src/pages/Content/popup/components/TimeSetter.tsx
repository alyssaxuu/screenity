import React, { useContext, useEffect, useState, useRef } from "react";

// Context
import { contentStateContext } from "../../context/ContentState";

const TimeSetter = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [hours, setHours] = useState(Math.floor(contentState.alarmTime / 3600));
  const [minutes, setMinutes] = useState(
    Math.floor((contentState.alarmTime % 3600) / 60)
  );
  const [seconds, setSeconds] = useState(
    Math.floor((contentState.alarmTime % 3600) % 60)
  );

  useEffect(() => {
    // Get from contentState
    setHours(Math.floor(contentState.alarmTime / 3600));
    setMinutes(Math.floor((contentState.alarmTime % 3600) / 60));
    setSeconds(Math.floor((contentState.alarmTime % 3600) % 60));
  }, []);

  useEffect(() => {
    if (!contentState.fromAlarm) return;
    // Set the time in seconds
    setHours(Math.floor(contentState.alarmTime / 3600));
    setMinutes(Math.floor((contentState.alarmTime % 3600) / 60));
    setSeconds(Math.floor((contentState.alarmTime % 3600) % 60));
  }, [contentState.alarmTime]);

  useEffect(() => {
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return;
    if (hours === "" || minutes === "" || seconds === "") return;
    setHours(parseFloat(hours));
    setMinutes(parseFloat(minutes));
    setSeconds(parseFloat(seconds));
    // Set the time in seconds
    setContentState((prevContentState) => ({
      ...prevContentState,
      alarmTime: hours * 3600 + minutes * 60 + seconds,
      fromAlarm: false,
      time: hours * 3600 + minutes * 60 + seconds,
      timer: hours * 3600 + minutes * 60 + seconds,
    }));
    chrome.storage.local.set({
      alarmTime: hours * 3600 + minutes * 60 + seconds,
    });
  }, [hours, minutes, seconds]);

  useEffect(() => {
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return;
    if (contentState.alarm) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        time: hours * 3600 + minutes * 60 + seconds,
        timer: hours * 3600 + minutes * 60 + seconds,
        fromAlarm: false,
      }));
    } else {
      setContentState((prevContentState) => ({
        ...prevContentState,
        time: 0,
        timer: 0,
      }));
    }
  }, [contentState.alarm]);

  const handleHours = (e) => {
    // Limit between 0 to 4, number only
    // Only 1 digit
    if (e.target.value.length > 1) {
      if (e.target.value[0] === "0") {
        e.target.value = parseFloat(e.target.value[1]);
      } else {
        return;
      }
    }
    if (isNaN(e.target.value)) {
      return;
    }
    if (e.target.value > 4) {
      e.target.value = 4;
    }
    setContentState((prevContentState) => ({
      ...prevContentState,
      fromAlarm: true,
    }));

    setHours(e.target.value);
  };

  const handleMinutes = (e) => {
    // Limit between 0 to 59, number only
    if (isNaN(e.target.value)) {
      return;
    }
    if (e.target.value > 59) {
      e.target.value = 59;
    }
    setContentState((prevContentState) => ({
      ...prevContentState,
      fromAlarm: true,
    }));

    setMinutes(e.target.value);
  };

  const handleSeconds = (e) => {
    // Limit between 0 to 59, number only
    if (isNaN(e.target.value)) {
      return;
    }
    if (e.target.value > 59) {
      e.target.value = 59;
    }
    setContentState((prevContentState) => ({
      ...prevContentState,
      fromAlarm: true,
    }));
    setSeconds(e.target.value);
  };

  return (
    <div className="time-set-parent">
      <div className="time-set-input">
        <input
          placeholder="0"
          onChange={handleMinutes}
          value={minutes}
          onBlur={(e) => {
            if (e.target.value === "") {
              e.target.value = 0;
              setMinutes(0);
            }
          }}
          onFocus={(e) => {
            e.target.select();
          }}
        />
        <span>M</span>
      </div>
      <div className="time-set-input">
        <input
          placeholder="0"
          onChange={handleSeconds}
          value={seconds}
          onBlur={(e) => {
            if (e.target.value === "") {
              e.target.value = 0;
              setSeconds(0);
            }
          }}
          onFocus={(e) => {
            e.target.select();
          }}
        />
        <span>S</span>
      </div>
    </div>
  );
};

export default TimeSetter;
