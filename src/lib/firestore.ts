import { Firestore } from "@google-cloud/firestore";

declare global {
  // allow attaching a Firestore singleton to the globalThis object in development
  var firestore: Firestore | undefined;
}

let firestore: Firestore;

if (process.env.NODE_ENV === "production") {
  firestore = new Firestore();
} else {
  if (!global.firestore) {
    global.firestore = new Firestore();
  }
  firestore = global.firestore as Firestore;
}

export { firestore };