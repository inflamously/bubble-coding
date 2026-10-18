"use strict";
// Track mutations: each changes the track in place and returns a short message for the CLI.
// One file per operation; ops that belong together share one.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./add"), exports);
__exportStar(require("./fog"), exports);
__exportStar(require("./rename"), exports);
__exportStar(require("./hint"), exports);
__exportStar(require("./remove"), exports);
__exportStar(require("./move"), exports);
__exportStar(require("./handoff"), exports);
__exportStar(require("./mark"), exports);
__exportStar(require("./done"), exports);
