// Host stand-in: only the result record the display controller reads.
#pragma once
#include <Arduino.h>

namespace inventatory_scan {
struct SyncResult {
  String resultId;
  String eventId;
  String status;
  bool existing = false;
  String itemName;
  String purposeLabel;
  int requestedDelta = 0;
  int appliedDelta = 0;
  int quantity = 0;
  String location;
  String code;
  String message;
};
}  // namespace inventatory_scan
