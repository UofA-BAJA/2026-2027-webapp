import { useRef, useState } from "react";
import { VENUE } from "../../config/venues";
import { setCourse, useCourse } from "../../hooks/useCourse";
import { downloadTrack, newTrackId, saveTrack, useTracks } from "../../hooks/useTracks";
import { courseFromTrack, parseTrack, trackFromCourse } from "../../lib/tracks";

// The TRACK section of the GPS settings: saved tracks (tap one to time laps on it), import a file (GeoJSON, GPX or
// KML, kept as GeoJSON), export the active one, and once a recorded route locks, save it under a name.
// "record new" is shown but disabled for now.

export function TrackSection({ setNote }: { setNote: (n: string) => void }) {
  const tracks = useTracks();
  const course = useCourse();
  const [name, setName] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const active = tracks.find((t) => t.id === course.trackId);
  const unsaved = course.route && !course.trackId && !course.recording; // lap 1 locked a route nobody has saved yet

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    const t = parseTrack(await f.text(), newTrackId(), f.name);
    if (typeof t === "string") return setNote(`${f.name}: ${t}`);
    saveTrack(t);
    setCourse(courseFromTrack(t));
    setNote(`imported ${t.name}`);
  };
  const save = () => {
    const t = trackFromCourse(course, newTrackId(), name.trim() || "recorded track", VENUE.location);
    saveTrack(t);
    setCourse({ ...course, trackId: t.id });
    setName("");
    setNote(`saved ${t.name} in this browser: export it to keep it in the repo`);
  };

  return (
    <>
      <h3>track</h3>
      <div className="tv2-settings-list">
        {tracks.map((t) => (
          <button key={t.id} type="button" className={`tv2-settings-track${t.id === active?.id ? " on" : ""}`} aria-pressed={t.id === active?.id}
            onClick={() => (setCourse(courseFromTrack(t)), setNote(""))}>
            {t.name}
          </button>
        ))}
      </div>
      {course.recording && <p className="tv2-settings-note">recording: drive one full lap from the start line</p>}
      {unsaved && (
        <form className="tv2-settings-save" onSubmit={(e) => (e.preventDefault(), save())}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name this route" aria-label="track name" maxLength={60} />
          <button type="submit" className="tv2-settings-action">save track</button>
        </form>
      )}
      <div className="tv2-settings-row">
        <span className="tv2-settings-opt">
          {/* not wired up yet: markStartFinish() in hooks/useCourse.ts is what it would call */}
          <button type="button" className="tv2-settings-action tv2-act" disabled>record new</button>
          <small className="tv2-settings-hint">(doesn't work yet)</small>
        </span>
        <button type="button" className="tv2-settings-action tv2-act" onClick={() => file.current?.click()}>import file</button>
        {active && <button type="button" className="tv2-settings-action tv2-act" onClick={() => downloadTrack(active)}>export .geojson</button>}
        <input ref={file} type="file" accept=".geojson,.json,.gpx,.kml" hidden onChange={(e) => (importFile(e.target.files?.[0]), (e.target.value = ""))} />
      </div>
    </>
  );
}
