import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import VideoItem from "../components/VideoItem";
import { PlaceholderThumb } from "../../images/popup/images";
import { useContext } from "react";
import { contentStateContext } from "../../context/ContentState";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  DropdownIcon,
  CheckWhiteIcon,
  SearchIcon,
  SearchCloseIcon,
  EmptySearchIcon,
  EmptyVideosIcon,
} from "../../images/popup/images";

import {
  TempTwitter,
  TempFigma,
  TempDesignSystem,
  TempMarketing,
  TempSubstack,
} from "../../images/popup/images";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

// Sort is two decisions: which field, then which direction. field:direction
// maps to the sort key the videos API already understands (mirrors the
// dashboard's lib/dashboard/sortOptions.js).
const SORT_KEYS = {
  "lastSavedAt:desc": "newest",
  "lastSavedAt:asc": "leastRecentlyEdited",
  "createdAt:desc": "created",
  "createdAt:asc": "oldest",
  "title:asc": "alphabetical",
  "title:desc": "reverse-alphabetical",
  "duration:desc": "longest",
  "duration:asc": "shortest",
};
const SORT_PAIRS = Object.fromEntries(
  Object.entries(SORT_KEYS).map(([pair, key]) => [key, pair])
);
const parseSort = (sortBy) => {
  const [field, direction] = (SORT_PAIRS[sortBy] || SORT_PAIRS.newest).split(
    ":"
  );
  return { field, direction };
};
const sortKeyFor = (field, direction) => SORT_KEYS[`${field}:${direction}`];
const defaultDirectionFor = (field) => (field === "title" ? "asc" : "desc");

const SORT_FIELDS = [
  { value: "lastSavedAt", label: chrome.i18n.getMessage("sortFieldLastEdited") },
  { value: "createdAt", label: chrome.i18n.getMessage("sortFieldDateCreated") },
  { value: "title", label: chrome.i18n.getMessage("sortFieldName") },
  { value: "duration", label: chrome.i18n.getMessage("sortFieldLength") },
];

const ORDER_OPTIONS = {
  lastSavedAt: [
    { value: "desc", label: chrome.i18n.getMessage("orderNewestFirst") },
    { value: "asc", label: chrome.i18n.getMessage("orderOldestFirst") },
  ],
  createdAt: [
    { value: "desc", label: chrome.i18n.getMessage("orderNewestFirst") },
    { value: "asc", label: chrome.i18n.getMessage("orderOldestFirst") },
  ],
  title: [
    { value: "asc", label: chrome.i18n.getMessage("orderAToZ") },
    { value: "desc", label: chrome.i18n.getMessage("orderZToA") },
  ],
  duration: [
    { value: "desc", label: chrome.i18n.getMessage("orderLongestFirst") },
    { value: "asc", label: chrome.i18n.getMessage("orderShortestFirst") },
  ],
};

const VideosTab = (props) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [contentState, setContentState] = useContext(contentStateContext);
  const fetchedPagesRef = useRef(new Set()); // key = `${sortBy}-${page}`
  const videoCacheRef = useRef({}); // key: `${sortBy}-${page}` → video[]
  const VIDEO_CACHE_STORAGE_KEY = "cachedVideosBySort";

  const pageRef = useRef(0); // Track page here without triggering re-renders
  const observerRef = useRef();

  const PAGE_SIZE = 8;
  const sortBy = contentState.sortBy || "newest";
  const filter = "all";
  const { field: sortField, direction: sortDirection } = parseSort(sortBy);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  const lastFetchTimeRef = useRef(0);
  const retryTimerRef = useRef(null);
  const FETCH_COOLDOWN_MS = 1500;
  const SEARCH_DEBOUNCE_MS = 250;

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => () => clearTimeout(retryTimerRef.current), []);

  useEffect(() => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }

    chrome.storage.local.get(VIDEO_CACHE_STORAGE_KEY, (result) => {
      if (result?.[VIDEO_CACHE_STORAGE_KEY]) {
        videoCacheRef.current = result[VIDEO_CACHE_STORAGE_KEY];

        // Hydrate fetchedPagesRef with cached keys
        fetchedPagesRef.current = new Set(Object.keys(videoCacheRef.current));

        const matchingKeys = Object.keys(videoCacheRef.current).filter((key) =>
          key.startsWith(`${sortBy}-${filter}-${query}-`)
        );

        // Key is `${sortBy}-${filter}-${query}-${page}`, and sortBy/query can
        // contain hyphens themselves, so the page is the last segment, not the nth.
        const sortedKeys = matchingKeys.sort((a, b) => {
          const aPage = parseInt(a.slice(a.lastIndexOf("-") + 1), 10);
          const bPage = parseInt(b.slice(b.lastIndexOf("-") + 1), 10);
          return aPage - bPage;
        });

        const allCachedVideos = sortedKeys.flatMap(
          (key) => videoCacheRef.current[key] || []
        );

        setVideos(allCachedVideos);

        // Update pageRef to next page
        pageRef.current = sortedKeys.length;

        // If the last page is smaller than PAGE_SIZE, we're done
        const lastPageKey = sortedKeys[sortedKeys.length - 1];
        const lastPage = videoCacheRef.current[lastPageKey] || [];
        setHasMore(lastPage.length === PAGE_SIZE);
      } else {
        // No cache found, do initial fetch
        pageRef.current = 0;
        setHasMore(true);
        fetchVideos();
      }
    });
  }, []);

  useEffect(() => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }

    if (contentState.isSubscribed) {
      setVideos([]);
      pageRef.current = 0;
      setHasMore(true);
      fetchedPagesRef.current = new Set();
      fetchVideos();
    }
  }, [sortBy, filter, query]);

  const fetchVideos = useCallback(async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }

    if (!contentState.isSubscribed || loading || !hasMore) {
      return;
    }

    // Cancel any stale retry (scheduled by an older sortBy/filter/query
    // closure) so it can't fire after this newer call has already run.
    clearTimeout(retryTimerRef.current);

    const now = Date.now();
    const cooldownRemaining =
      FETCH_COOLDOWN_MS - (now - lastFetchTimeRef.current);

    if (cooldownRemaining > 0) {
      // Otherwise a sort/filter/query change landing inside the cooldown
      // window is dropped with nothing left to wake the list back up.
      retryTimerRef.current = setTimeout(fetchVideos, cooldownRemaining);
      return;
    }

    lastFetchTimeRef.current = now;

    const cacheKey = `${sortBy}-${filter}-${query}-${pageRef.current}`;
    if (fetchedPagesRef.current.has(cacheKey)) return;
    fetchedPagesRef.current.add(cacheKey);
    setLoading(true);

    try {
      if (videoCacheRef.current[cacheKey]) {
        const cachedVideos = videoCacheRef.current[cacheKey];
        setVideos((prev) => [...prev, ...cachedVideos]);

        if (cachedVideos.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          pageRef.current += 1;
        }

        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: "fetch-videos",
        page: pageRef.current,
        pageSize: PAGE_SIZE,
        sort: sortBy,
        filter,
        query,
      });

      if (!response?.success) {
        console.error("❌ Failed to fetch videos:", response?.error);
        setError(response?.error || "Failed to load videos");
        setHasMore(false);
        return;
      }

      const newVideos = response.videos || [];
      setVideos((prev) => [...prev, ...newVideos]);

      if (newVideos.length > 0) {
        videoCacheRef.current[cacheKey] = newVideos;
        chrome.storage.local.set({
          [VIDEO_CACHE_STORAGE_KEY]: videoCacheRef.current,
        });
      }

      if (newVideos.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        pageRef.current += 1;
      }
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      setError("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, contentState.isSubscribed, sortBy, filter, query]);

  // useEffect(() => {
  //   if (contentState.isSubscribed) {
  //     fetchVideos();
  //   }
  // }, []); // Run once on mount

  useEffect(() => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }
    if (!observerRef.current || !hasMore || !contentState.isSubscribed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchVideos();
        }
      },
      { threshold: 1.0 }
    );

    observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [fetchVideos, hasMore]);

  const handleVideoClick = (videoId) => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }
    const url = process.env.SCREENITY_APP_BASE + `/editor/${videoId}/edit`;
    window.open(url, "_blank");
  };

  const handleCopyLink = (videoId) => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }
    const link = process.env.SCREENITY_APP_BASE + `/view/${videoId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        contentState.openToast(
          chrome.i18n.getMessage("copiedToClipboardToast"),
          3000
        );
      })
      .catch((err) => {
        console.error("❌ Failed to copy:", err);
        contentState.openToast(
          chrome.i18n.getMessage("failedToCopyToClipboardToast"),
          3000
        );
      });
  };

  useEffect(() => {
    if (!CLOUD_FEATURES_ENABLED) {
      // show only local placeholder videos
      return;
    }
    chrome.storage.local.get(["sortBy"], (result) => {
      if (result.sortBy && !contentState.sortBy) {
        setContentState((prev) => ({ ...prev, sortBy: result.sortBy }));
      }
    });
  }, []);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchInput("");
  };

  const setSortBy = (value) => {
    setContentState((prev) => ({ ...prev, sortBy: value }));
    chrome.storage.local.set({ sortBy: value });
  };

  const currentFieldLabel =
    SORT_FIELDS.find((f) => f.value === sortField)?.label ||
    SORT_FIELDS[0].label;

  return (
    <div
      className={contentState.isSubscribed ? "video-ui" : "video-ui blurred"}
    >
      {!contentState.isSubscribed && (
        <div className="ModalSoon">
          {/* 👇 Embed the video here */}
          <video
            src={chrome.runtime.getURL("assets/videos/pro.mp4")}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              borderRadius: "6px",
              marginBottom: "20px",
            }}
          />
          <div className="ModalSoonTitle">
            {chrome.i18n.getMessage("shareModalSandboxTitle")}
          </div>

          <div className="ModalSoonDescription">
            {chrome.i18n.getMessage("shareModalSandboxDescription")}
          </div>

          <div
            className="ModalSoonButton"
            onClick={() => {
              chrome.runtime.sendMessage({ type: "pricing" });
            }}
          >
            {chrome.i18n.getMessage("shareModalSandboxButton")}
          </div>

          <button
            onClick={() => {
              chrome.runtime.sendMessage({ type: "handle-login" });
            }}
            className="ModalSoonSecondary"
            style={{
              marginTop: 16,
              width: "100%",
              background: "transparent",
              border: "none",
              color: "#6B7280",
              fontSize: 13,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            {chrome.i18n.getMessage("shareModalSandboxLogin")}
          </button>
        </div>
      )}
      <Tabs.Root className="TabsRoot" defaultValue="personal">
        <Tabs.List className="TabsList" aria-label="Manage your account">
          <div className="TabsTriggerWrap">
            <Tabs.Trigger className="TabsTrigger" value="personal">
              <div className="TabsTriggerLabel">
                <span>{chrome.i18n.getMessage("allVideosHeading")}</span>
              </div>
            </Tabs.Trigger>
            {/* <Tabs.Trigger className="TabsTrigger" value="team">
              <div className="TabsTriggerLabel">
                <span>Team</span>
              </div>
            </Tabs.Trigger>
            <Tabs.Trigger className="TabsTrigger" value="shared">
              <div className="TabsTriggerLabel">
                <span>Shared</span>
              </div>
            </Tabs.Trigger> */}
          </div>
          <div
            className={
              searchOpen ? "TabsListActions searching" : "TabsListActions"
            }
          >
            {searchOpen ? (
              <div className="TabsSearchInline">
                <img src={SearchIcon} alt="" />
                <input
                  type="text"
                  className="TabsSearchInput"
                  placeholder={chrome.i18n.getMessage(
                    "searchVideosPlaceholder"
                  )}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Google and others focus their own search box on any
                    // keystroke that reaches the page, stealing what we type.
                    e.stopPropagation();
                    if (e.key === "Escape") closeSearch();
                  }}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  autoFocus
                />
                <button
                  type="button"
                  className="TabsIconButton"
                  aria-label="Close search"
                  onClick={closeSearch}
                >
                  <img src={SearchCloseIcon} alt="" />
                </button>
              </div>
            ) : (
              <>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="TabsSort" aria-label="Sort videos">
                      <div className="TabsSortLabel">
                        {currentFieldLabel} <img src={DropdownIcon} />
                      </div>
                    </button>
                  </DropdownMenu.Trigger>

                  <DropdownMenu.Portal
                    container={props.shadowRef.current.shadowRoot.querySelector(
                      ".container"
                    )}
                  >
                    <DropdownMenu.Content
                      className="DropdownMenuContent"
                      sideOffset={4}
                      align="end"
                    >
                      <DropdownMenu.Label className="DropdownMenuLabel">
                        {chrome.i18n.getMessage("sortByHeading")}
                      </DropdownMenu.Label>
                      <DropdownMenu.RadioGroup
                        value={sortField}
                        onValueChange={(newField) => {
                          setSortBy(
                            sortKeyFor(newField, defaultDirectionFor(newField))
                          );
                        }}
                      >
                        {SORT_FIELDS.map((f) => (
                          <DropdownMenu.RadioItem
                            key={f.value}
                            className="DropdownMenuItem"
                            value={f.value}
                          >
                            {f.label}
                            <DropdownMenu.ItemIndicator className="ItemIndicator">
                              <img src={CheckWhiteIcon} />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        ))}
                      </DropdownMenu.RadioGroup>

                      <DropdownMenu.Separator className="DropdownMenuSeparator" />

                      <DropdownMenu.Label className="DropdownMenuLabel">
                        {chrome.i18n.getMessage("orderHeading")}
                      </DropdownMenu.Label>
                      <DropdownMenu.RadioGroup
                        value={sortDirection}
                        onValueChange={(newDirection) => {
                          setSortBy(sortKeyFor(sortField, newDirection));
                        }}
                      >
                        {ORDER_OPTIONS[sortField].map((o) => (
                          <DropdownMenu.RadioItem
                            key={o.value}
                            className="DropdownMenuItem"
                            value={o.value}
                          >
                            {o.label}
                            <DropdownMenu.ItemIndicator className="ItemIndicator">
                              <img src={CheckWhiteIcon} />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        ))}
                      </DropdownMenu.RadioGroup>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <button
                  type="button"
                  className="TabsIconButton"
                  aria-label="Search videos"
                  onClick={() => setSearchOpen(true)}
                >
                  <img src={SearchIcon} alt="" />
                </button>
              </>
            )}
          </div>
        </Tabs.List>

        <Tabs.Content className="TabsContent" value="personal">
          <div className="videos-list">
            {error && <p>{error}</p>}
            {videos.length === 0 &&
              !loading &&
              !error &&
              contentState.isSubscribed && (
                <div className="empty-state">
                  <img
                    className="empty-state-icon"
                    src={query ? EmptySearchIcon : EmptyVideosIcon}
                    alt=""
                  />
                  <div className="empty-state-title">
                    {query
                      ? chrome.i18n.getMessage("noVideosMatchSearchTitle", [
                          query,
                        ])
                      : chrome.i18n.getMessage("noVideosFound")}
                  </div>
                  {query && (
                    <div className="empty-state-description">
                      {chrome.i18n.getMessage("noVideosMatchSearchHint")}
                    </div>
                  )}
                </div>
              )}
            {(contentState.isSubscribed
              ? videos
              : [
                  {
                    title: "Bug report",
                    createdAt: "3 minutes ago",
                    data: { thumbnail: TempTwitter },
                  },
                  {
                    title: "Figma async review",
                    createdAt: "1 hour ago",
                    data: { thumbnail: TempFigma },
                  },
                  {
                    title: "Design systems onboarding",
                    createdAt: "4 days ago",
                    data: { thumbnail: TempDesignSystem },
                  },
                  {
                    title: "Cool SaaS resources",
                    createdAt: "Feb 12",
                    data: { thumbnail: TempMarketing },
                  },
                  {
                    title: "Newsletter promo",
                    createdAt: "Jan 23",
                    data: { thumbnail: TempSubstack },
                  },
                  {
                    title: "Product demo",
                    createdAt: "Jan 15",
                    data: { thumbnail: PlaceholderThumb },
                  },
                ]
            ).map((video, i) => (
              <VideoItem
                key={i}
                title={video.title}
                date={video.createdAt}
                thumbnail={
                  (video.data?.useCustomThumbnail &&
                    video.data?.customThumbnail) ||
                  video.data?.generatedThumbnail ||
                  video.data?.tempThumbnail ||
                  PlaceholderThumb
                }
                isPublic={video.isPublic}
                onOpen={
                  contentState.isSubscribed
                    ? () => handleVideoClick(video._id)
                    : undefined
                }
                onCopyLink={
                  contentState.isSubscribed
                    ? () => handleCopyLink(video._id)
                    : undefined
                }
              />
            ))}
            {loading && videos.length === 0 && (
              <div className="spinner-container">
                <div className="spinner" />
                <span>{chrome.i18n.getMessage("loadingVideosLabel")}</span>
              </div>
            )}
            {loading && videos.length > 0 && (
              <div className="load-more-indicator">
                <div className="spinner spinner-small" />
                <span>{chrome.i18n.getMessage("loadingMoreVideosLabel")}</span>
              </div>
            )}
            <div ref={observerRef} style={{ height: "1px" }} />
          </div>

          <div
            className="bottom-section"
            style={
              !contentState.isSubscribed
                ? { zIndex: 1, pointerEvents: "none" }
                : undefined
            }
          >
            <a
              href={process.env.SCREENITY_APP_BASE}
              target="_blank"
              rel="noopener noreferrer"
              role="button"
              className="main-button dashboard-button"
              tabIndex={contentState.isSubscribed ? "0" : "-1"}
              style={{
                zIndex: 99,
              }}
            >
              <span className="main-button-label">
                {chrome.i18n.getMessage("goToDashboardButtonLabel")}
              </span>
              {/* <span className="main-button-shortcut">Ctrl+D</span> */}
            </a>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default VideosTab;
