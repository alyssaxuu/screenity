import React from "react";

const formatDeletionDate = (isoDate) => {
  try {
    const date = new Date(isoDate);

    // Get the extension locale (fallback to 'en')
    const locale = chrome?.i18n?.getUILanguage?.() || "en";

    // Use numeric-only format if not English
    const useFallback = !locale.startsWith("en");

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: useFallback ? "2-digit" : "long",
      day: "2-digit",
    });
  } catch {
    return "unknown date";
  }
};

const InactiveSubscription = ({
  onManageClick,
  onDowngradeClick,
  subscription,
  hasSubscribedBefore,
}) => {
  const deletionDate = subscription?.deletionAt || subscription?.endsAt;
  const formattedDate = deletionDate ? formatDeletionDate(deletionDate) : null;

  return (
    <div
      className="announcement"
      style={{ marginTop: "50px", paddingBottom: "0px" }}
    >
      <div className="announcement-wrap">
        <div className="announcement-details">
          <div className="welcome-title" style={{ marginBottom: "10px" }}>
            {hasSubscribedBefore
              ? chrome.i18n.getMessage("inactiveSubscriptionTitle") ||
                "Your Pro subscription is inactive"
              : chrome.i18n.getMessage("noSubscriptionYetTitle") ||
                "Unlock Pro to get started"}
          </div>

          <div
            className="welcome-description"
            style={{
              fontSize: "14px",
              color: "#6E7684",
              lineHeight: "1.5",
              marginBottom: "20px",
            }}
          >
            {chrome.i18n.getMessage("inactiveSubscriptionDescription") ||
              "Your Screenity Pro subscription is inactive."}
            <br />
            {hasSubscribedBefore
              ? chrome.i18n.getMessage("inactiveSubscriptionReactivation") ||
                "Please reactivate to resume access."
              : chrome.i18n.getMessage("noSubscriptionYetDescription") ||
                "Please subscribe to access Pro features."}
          </div>

          {formattedDate && hasSubscribedBefore && (
            <div
              style={{
                backgroundColor: "#FFF8FA",
                borderRadius: "30px",
                padding: "1.25rem 1.5rem",
                color: "#F0175B",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "1.5",
                marginBottom: "1.5rem",
              }}
            >
              {chrome.i18n.getMessage("inactiveSubscriptionDeletionWarning") ||
                "Your videos and data will be permanently deleted on "}
              <strong
                style={{
                  fontFamily: "Satoshi-Bold, sans-serif",
                }}
              >
                {formattedDate}
              </strong>
            </div>
          )}

          <div
            className="welcome-cta"
            style={{
              marginBottom: "20px",
              backgroundColor: "#29292F",
              boxSizing: "border-box",
              color: "white",
              height: "45px",
              width: "100%",
              borderRadius: "999px",
              textAlign: "center",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
            onClick={onManageClick}
          >
            {hasSubscribedBefore
              ? chrome.i18n.getMessage("manageSubscriptionButton") ||
                "Manage your subscription"
              : chrome.i18n.getMessage("upgradeToProButton") ||
                "Upgrade to Pro"}
          </div>
        </div>
      </div>
      <div className="welcome-content">
        <div className="welcome-content-wrap">
          <div
            style={{
              marginBottom: "12px",
              fontSize: "14px",
              color: "#6E7684",
              textAlign: "center",
            }}
          >
            {chrome.i18n.getMessage("inactiveSubscriptionFreeVersion") ||
              "Want to keep using the free version?"}
          </div>

          <div
            className="welcome-cta"
            style={{
              backgroundColor: "white",
              border: "1px solid #E5E7EB",
              boxSizing: "border-box",
              height: "45px",
              width: "100%",
              borderRadius: "999px",
              textAlign: "center",
              fontWeight: "600",
              cursor: "pointer",
              color: "#141416",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
            onClick={onDowngradeClick}
          >
            {chrome.i18n.getMessage("downgradeToFreeButton") ||
              "Log out and downgrade"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InactiveSubscription;
