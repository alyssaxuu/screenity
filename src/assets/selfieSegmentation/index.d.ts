/**
 * @fileoverview Declarations for the face tracking API.
 */

/**
 * Version number of this package.
 */
export const VERSION: string;

/**
 * We support several ways to get image inputs.
 */
export type InputImage = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

/**
 * Legal inputs.
 */
export interface InputMap {
  image: InputImage;
}

/**
 * GpuBuffers should all be compatible with Canvas' `drawImage`
 */
type GpuBuffer = HTMLCanvasElement | HTMLImageElement | ImageBitmap;

/**
 * Possible results from SelfieSegmentation.
 */
export interface Results {
  image: GpuBuffer;
  segmentationMask: GpuBuffer;
}

/**
 * Configurable options for SelfieSegmentation.
 */
export interface Options {
  selfieMode?: boolean;
  modelSelection?: number;
}

/**
 * Listener for any results from SelfieSegmentation.
 */
export type ResultsListener = (results: Results) => (Promise<void>|void);

/**
 * Contains all of the setup options to drive the face solution.
 */
export interface SelfieSegmentationConfig {
  locateFile?: (path: string, prefix?: string) => string;
}

/**
 * Declares the interface of SelfieSegmentation.
 */
declare interface SelfieSegmentationInterface {
  close(): Promise<void>;
  onResults(listener: ResultsListener): void;
  initialize(): Promise<void>;
  reset(): void;
  send(inputs: InputMap): Promise<void>;
  setOptions(options: Options): void;
}

/**
 * Encapsulates the entire SelfieSegmentation solution. All that is needed from the
 * developer is the source of the image data. The user will call `send`
 * repeatedly and if a face is detected, then the user can receive callbacks
 * with this metadata.
 */
export declare class SelfieSegmentation implements SelfieSegmentationInterface {
  constructor(config?: SelfieSegmentationConfig);

  /**
   * Shuts down the object. Call before creating a new instance.
   */
  close(): Promise<void>;

  /**
   * Registers a single callback that will carry any results that occur
   * after calling Send().
   */
  onResults(listener: ResultsListener): void;

  /**
   * Initializes the solution. This includes loading ML models and mediapipe
   * configurations, as well as setting up potential listeners for metadata. If
   * `initialize` is not called manually, then it will be called the first time
   * the developer calls `send`.
   */
  initialize(): Promise<void>;

  /**
   * Tells the graph to restart before the next frame is sent.
   */
  reset(): void;

  /**
   * Processes a single frame of data, which depends on the options sent to the
   * constructor.
   */
  send(inputs: InputMap): Promise<void>;

  /**
   * Adjusts options in the solution. This may trigger a graph reload the next
   * time the graph tries to run.
   */
  setOptions(options: Options): void;
}
