import { IdbChunkReader } from "./idbChunkReader";
import { OpfsChunkReader } from "./opfs/opfsChunkReader";

export const chooseReader = (backendRef) => {
  const backend = backendRef?.backend || "idb";
  switch (backend) {
    case "opfs":
      return new OpfsChunkReader();
    case "idb":
    default:
      return new IdbChunkReader();
  }
};
