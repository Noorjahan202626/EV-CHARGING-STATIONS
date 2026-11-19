// Path to the local video file (already in the project’s assets folder)

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { EASE } from "../ui/easing";
import useNetworkStats from "../../hooks/useNetworkStats";
// <‑‑ add the line below
import combinedVideo from "../../assets/video/Combined_Recording_v2.mp4";
import { photos } from "../../config/photos";


function Float({ className = "", delay = 0, children }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { duration: 0.6, delay: 0.4 + delay, ease: EASE },
        y: {
          duration: 5,
          delay,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
    >
      {children}
    </motion.div>
  );
}



const fmt = (n) => n.toLocaleString("en-IN");

// Photorealistic real-world electric SUV media collection
// Shows entire vehicle (all four wheels, body, windows, front, rear) with soft natural lighting
const MEDIA_VIEWS = [
  {
    id: "video",
    label: "Real-World Reel",
    icon: "bi-camera-video-fill",
    type: "video",
    title: "Photorealistic Electric SUV",
    subtitle: "High-Power DC Fast Charging Bay",
    videoSrc: combinedVideo,
    videoBackup: combinedVideo,
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Audi_E_Tron_Plugged_In_To_Electrify_America_Charging_Station.jpg/1280px-Audi_E_Tron_Plugged_In_To_Electrify_America_Charging_Station.jpg",
    alt: "Photorealistic electric SUV plugged into an ultra-fast DC charger with all wheels and body visible",
    pos: "center 56%",
  },
  {
    id: "etron",
    label: "Audi e-tron Full SUV",
    icon: "bi-lightning-charge-fill",
    type: "image",
    title: "Audi e-tron Electric SUV",
    subtitle: "Entire Vehicle • All 4 Wheels • Fast Charger",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Audi_E_Tron_Plugged_In_To_Electrify_America_Charging_Station.jpg/1280px-Audi_E_Tron_Plugged_In_To_Electrify_America_Charging_Station.jpg",
    fallback: photos.hero?.src,
    alt: "Full vehicle photograph of Audi e-tron electric SUV plugged in at Electrify America charging station",
    pos: "center 50%",
  },
  {
    id: "modelx",
    label: "Flagship EV SUV Profile",
    icon: "bi-ev-station-fill",
    type: "image",
    title: "Ultra-Fast Supercharging",
    subtitle: "Full Chassis & Wheels • Natural Daylight",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Tesla_model_X_supercharging.jpg/1280px-Tesla_model_X_supercharging.jpg",
    fallback: photos.hero?.src,
    alt: "Real electric SUV charging in daytime showing complete body, windows and alloy wheels",
    pos: "center 52%",
  },
];

export default function RealWorldEVVisual() {
  const { status, stations } = useNetworkStats();
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageError, setImageError] = useState({});
  const videoRef = useRef(null);

  const activeMedia = MEDIA_VIEWS[activeIdx];

  // Sync play/pause with user interaction
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => { });
      setIsPlaying(true);
    }
  };

  // Re-attempt autoplay when switching back to video view
  useEffect(() => {
    if (activeMedia.type === "video" && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Browser autoplay policy might require mute
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => { });
        }
      });
      setIsPlaying(true);
    }
  }, [activeIdx]);

  return (
    <motion.div
      className="lp-hero-visual"
      initial={{ opacity: 0, scale: 0.95, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.85, delay: 0.18, ease: EASE }}
    >
      {/* Main Real-World Electric Vehicle Frame */}
      <motion.div
        className="lp-ev-frame"
        whileHover={{ scale: 1.012 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        {/* Atmosphere & Lighting Grading Overlay (matches green-and-white theme) */}
        <div className="lp-ev-atmosphere" />
        <div className="lp-ev-gradient-bottom" />

        {/* Media Viewer: Realistic Video or Automotive Photography */}
        <AnimatePresence mode="wait">
          {activeMedia.type === "video" && !videoFailed ? (
            <motion.div
              key="ev-video-container"
              className="lp-ev-media-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <video
                ref={videoRef}
                className="lp-ev-media"
                autoPlay
                loop
                muted
                playsInline
                poster={activeMedia.poster}
                onError={() => setVideoFailed(true)}
              >
                <source src={activeMedia.videoSrc} type="video/mp4" />
                <source src={activeMedia.videoBackup} type="video/mp4" />
                Your browser does not support HTML5 video.
              </video>
            </motion.div>
          ) : (
            <motion.div
              key={`ev-img-${activeMedia.id}`}
              className="lp-ev-media-wrap"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <img
                src={imageError[activeMedia.id] ? activeMedia.fallback : (activeMedia.src || activeMedia.poster)}
                alt={activeMedia.alt}
                className="lp-ev-media"
                style={{ objectPosition: activeMedia.pos }}
                onError={() => {
                  setImageError((prev) => ({ ...prev, [activeMedia.id]: true }));
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Control Bar: Mode Selector & Play/Pause */}
        <div className="lp-ev-controls">
          {MEDIA_VIEWS.map((view, i) => (
            <button
              key={view.id}
              type="button"
              className={`lp-ev-btn-ctrl ${activeIdx === i ? "active" : ""}`}
              onClick={() => setActiveIdx(i)}
              title={view.title}
            >
              <i className={`bi ${view.icon}`} />
              <span>{view.label}</span>
            </button>
          ))}

          {activeMedia.type === "video" && !videoFailed && (
            <button
              type="button"
              className="lp-ev-btn-ctrl lp-ev-btn-play"
              onClick={togglePlay}
              title={isPlaying ? "Pause Video" : "Play Video"}
              aria-label={isPlaying ? "Pause Video" : "Play Video"}
            >
              <i className={`bi ${isPlaying ? "bi-pause-fill" : "bi-play-fill"}`} />
            </button>
          )}
        </div>

        {/* Top Right Live Telemetry Badge (Soft emerald glow) */}
        {/* Removed badge */}

        {/* Bottom Integrated Telemetry Overlay */}
        {/* Removed telemetry overlay */}

      </motion.div>

      {/* Floating Network Telemetry Cards (Motion for React) */}
      <Float className="lp-float lp-f1" delay={0}>
        <span className="ev-icon sm">
          <i className="bi bi-geo-alt" />
        </span>
        <div>
          <small>Stations in network</small>
          <b>
            {status === "loading" && <span className="ev-skeleton">0000</span>}
            {status === "ready" && fmt(stations)}
            {status === "error" && "Unavailable"}
          </b>
        </div>
      </Float>

      <Float className="lp-float lp-f2" delay={1.4}>
        <span className="ev-icon sm">
          <i className="bi bi-plug" />
        </span>
        <div>
          <small>Charger status</small>
          <b>Tracked per charger</b>
        </div>
      </Float>

      <Float className="lp-float lp-f3" delay={2.8}>
        <span className="ev-icon sm">
          <i className="bi bi-cpu" />
        </span>
        <div>
          <small>Smart allocation</small>
          <b>Queue-aware</b>
        </div>
      </Float>
    </motion.div>
  );
}
