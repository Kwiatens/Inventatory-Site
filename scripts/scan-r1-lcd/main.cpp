// Renders Scan R1 LCD frames for the website with the scanner's own display code.
//
// The firmware's DisplayController and DisplayRenderer are compiled unmodified against the
// real u8g2 library and the real ST7565 ERC12864 setup; only SPI, GPIO and the clock are
// stubbed (see shim/). Each scene drives the controller the way the app does after a scan
// or a key press, ticks it every 10 ms of fake time, and records every frame the firmware
// would have sent to the panel, with its timestamp.
//
// Output (stdout): JSON { width, height, frames: [base64 row-major 1-bit], scenes: { name: [[ms, frame], ...] } }

#include <map>
#include <string>
#include <vector>

#include "display/display_controller.h"

using namespace inventatory_scan;

unsigned long g_scan_r1_now = 0;
extern "C" uint8_t scan_r1_stub_cb(u8x8_t*, uint8_t, uint8_t, void*) { return 1; }

namespace {

std::vector<std::string> frames;
std::map<std::string, int> frameIndex;
std::vector<std::pair<std::string, std::vector<std::pair<unsigned long, int>>>> scenes;
// What the user did, per scene: "scan", "key:A", ... so the site can drive the keypad and beam.
std::vector<std::vector<std::pair<unsigned long, std::string>>> events;
unsigned long sceneStart = 0;

std::string base64(const std::vector<uint8_t>& in) {
  static const char* t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  for (std::size_t i = 0; i < in.size(); i += 3) {
    uint32_t n = in[i] << 16 | (i + 1 < in.size() ? in[i + 1] << 8 : 0) | (i + 2 < in.size() ? in[i + 2] : 0);
    out += t[n >> 18 & 63];
    out += t[n >> 12 & 63];
    out += i + 1 < in.size() ? t[n >> 6 & 63] : '=';
    out += i + 2 < in.size() ? t[n & 63] : '=';
  }
  return out;
}

}  // namespace

void scan_r1_on_delay(unsigned long ms) { g_scan_r1_now += ms; }

void scan_r1_on_frame(u8g2_t* u8g2) {
  if (scenes.empty()) return;
  // Full-buffer ST7565 layout: 8-pixel vertical bytes, one 128-byte page per 8 rows.
  const uint8_t* buf = u8g2_GetBufferPtr(u8g2);
  const int tileW = u8g2_GetBufferTileWidth(u8g2);
  std::vector<uint8_t> rows(128 / 8 * 64, 0);
  for (int y = 0; y < 64; ++y)
    for (int x = 0; x < 128; ++x)
      if (buf[(y / 8) * tileW * 8 + x] >> (y & 7) & 1) rows[y * 16 + x / 8] |= 0x80 >> (x & 7);
  const auto encoded = base64(rows);
  auto found = frameIndex.find(encoded);
  int index;
  if (found == frameIndex.end()) {
    index = static_cast<int>(frames.size());
    frames.push_back(encoded);
    frameIndex[encoded] = index;
  } else {
    index = found->second;
  }
  auto& timeline = scenes.back().second;
  const unsigned long t = g_scan_r1_now - sceneStart;
  if (!timeline.empty() && timeline.back().first == t) timeline.back().second = index;
  else if (timeline.empty() || timeline.back().second != index) timeline.push_back({t, index});
}

namespace {

DisplayController display;

// A scene ends with [ms, -1]: its length, so the site can loop it.
void endScene() {
  if (!scenes.empty()) scenes.back().second.push_back({g_scan_r1_now - sceneStart, -1});
}

void scene(const char* name) {
  endScene();
  scenes.push_back({name, {}});
  events.push_back({});
  sceneStart = g_scan_r1_now;
}

void mark(const char* what) { events.back().push_back({g_scan_r1_now - sceneStart, what}); }

void run(unsigned long ms) {
  for (unsigned long end = g_scan_r1_now + ms; g_scan_r1_now < end; g_scan_r1_now += 10) display.tick();
}

SyncResult done(const char* item, const char* purpose, int delta, int total) {
  SyncResult result;
  result.status = "completed";
  result.itemName = item;
  result.purposeLabel = purpose;
  result.requestedDelta = delta;
  result.appliedDelta = delta;
  result.quantity = total;
  return result;
}

}  // namespace

int main() {
  display.begin();

  // Power on: the ›i mark builds itself, then the name.
  scene("boot");
  display.playBootIntro();
  run(1800);

  display.setConnectivity(DisplayConnectivityState::Online, true, true, 0);

  // A new reel arrives: its DigiKey Data Matrix carries the part number and the quantity.
  // New parts land in an empty slot on the PC side; the scanner only shows the result.
  struct Receive { const char* scene; const char* mpn; const char* item; const char* purpose; int qty; };
  const Receive receives[] = {
      {"receive-1", "RC0603FR-0710KL", "RES 10K OHM 1% 0603", "Resistor", 100},
      {"receive-2", "GRM21BR61E106KA73L", "CAP CER 10UF 25V X5R 0805", "Capacitor", 50},
      {"receive-3", "1N4148W-7-F", "DIODE GEN PURP 100V 300MA SOD123", "Diode", 25},
  };
  for (const auto& r : receives) {
    scene(r.scene);
    display.showReady();
    run(2000);
    mark("scan");
    run(400);
    display.showQuantity("Checking inventory", String("Part ") + r.mpn, String(r.qty), 0, true,
                         QuantityLookupState::Pending);
    run(1000);
    display.updateQuantityLookup(r.item, QuantityLookupState::NotFound);
    run(2200);
    mark("key:A");
    display.showSending();
    run(900);
    display.showResult(done(r.item, r.purpose, r.qty, r.qty));
    mark("stored");
    run(3700);
  }

  // The homepage intake loop (22 s), timed to its storyboard: scan at 2.6 s, A at 6 s,
  // the PC's answer at 9 s; then the firmware's own dwell returns it to Ready.
  scene("intake");
  display.showReady();
  run(2600);
  mark("scan");
  run(100);
  display.showQuantity("Checking inventory", "Part RC0603FR-0710KL", "100", 0, true,
                       QuantityLookupState::Pending);
  run(1200);
  display.updateQuantityLookup("RES 10K OHM 1% 1/10W 0603", QuantityLookupState::NotFound);
  run(2100);
  mark("key:A");
  display.showSending();
  run(3000);
  display.showResult(done("RES 10K OHM 1% 1/10W 0603", "Resistor", 100, 100));
  mark("stored");
  run(13000);

  // At the bench: scan the QR code on a tube, type how many you took, B to subtract.
  scene("pick");
  display.showReady();
  run(1200);
  mark("scan");
  run(400);
  display.showQuantity("Checking inventory", "Code 0417", "1", 0, false, QuantityLookupState::Pending);
  run(700);
  display.updateQuantityLookup("CAP CER 10UF 25V X5R 0805", QuantityLookupState::Found);
  run(1100);
  mark("key:1");
  display.updateQuantity("1", 1);
  run(500);
  mark("key:2");
  display.updateQuantity("12", 2);
  run(1400);
  mark("key:B");
  display.showSending();
  run(800);
  display.showResult(done("CAP CER 10UF 25V X5R 0805", "Capacitor", -12, 38));
  mark("stored");
  run(3700);

  endScene();
  std::printf("{\"width\":128,\"height\":64,\"frames\":[");
  for (std::size_t i = 0; i < frames.size(); ++i) std::printf("%s\"%s\"", i ? "," : "", frames[i].c_str());
  std::printf("],\"scenes\":{");
  for (std::size_t s = 0; s < scenes.size(); ++s) {
    std::printf("%s\"%s\":[", s ? "," : "", scenes[s].first.c_str());
    const auto& timeline = scenes[s].second;
    for (std::size_t i = 0; i < timeline.size(); ++i)
      std::printf("%s[%lu,%d]", i ? "," : "", timeline[i].first, timeline[i].second);
    std::printf("]");
  }
  std::printf("},\"events\":{");
  for (std::size_t s = 0; s < scenes.size(); ++s) {
    std::printf("%s\"%s\":[", s ? "," : "", scenes[s].first.c_str());
    for (std::size_t i = 0; i < events[s].size(); ++i)
      std::printf("%s[%lu,\"%s\"]", i ? "," : "", events[s][i].first, events[s][i].second.c_str());
    std::printf("]");
  }
  std::printf("}}\n");
  return 0;
}
