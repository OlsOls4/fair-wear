/** A video URL is not an extracted image, and a SAM frame index is not a timestamp. */
export class UnsupportedVideoAnalysisError extends Error {
  readonly code = "VIDEO_ANALYSIS_UNSUPPORTED";
  constructor() {
    super("Video analysis is not supported: verified frame extraction and source-local image cropping are not connected to this pipeline. No model calls were made and no findings or evidence pack were generated. Explore the recorded image sample or prepare a manual photo case instead.");
    this.name = "UnsupportedVideoAnalysisError";
  }
}
