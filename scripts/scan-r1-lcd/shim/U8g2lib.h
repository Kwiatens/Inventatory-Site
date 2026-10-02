// Host stand-in for U8g2lib.h: the real u8g2 C library and the real ST7565 ERC12864 setup,
// with the SPI and GPIO callbacks stubbed out so frames stay in the full buffer.
#pragma once
#include <cstdarg>
#include "u8g2.h"

extern "C" uint8_t scan_r1_stub_cb(u8x8_t*, uint8_t, uint8_t, void*);
// Called with every finished frame, exactly when the firmware would push it over SPI.
void scan_r1_on_frame(u8g2_t* u8g2);

class U8G2_ST7565_ERC12864_ALT_F_4W_SW_SPI {
 public:
  U8G2_ST7565_ERC12864_ALT_F_4W_SW_SPI(const u8g2_cb_t* rotation, uint8_t, uint8_t, uint8_t, uint8_t, uint8_t) {
    u8g2_Setup_st7565_erc12864_alt_f(&u8g2, rotation, scan_r1_stub_cb, scan_r1_stub_cb);
  }
  void begin() { u8g2_InitDisplay(&u8g2); u8g2_SetPowerSave(&u8g2, 0); }
  void setContrast(uint8_t) {}
  void setPowerSave(uint8_t) {}
  void sendF(const char*, ...) {}
  void setFontMode(uint8_t m) { u8g2_SetFontMode(&u8g2, m); }
  void setDrawColor(uint8_t c) { u8g2_SetDrawColor(&u8g2, c); }
  void setFont(const uint8_t* f) { u8g2_SetFont(&u8g2, f); }
  int8_t getAscent() { return u8g2_GetAscent(&u8g2); }
  u8g2_uint_t getStrWidth(const char* s) { return u8g2_GetStrWidth(&u8g2, s); }
  u8g2_uint_t drawStr(u8g2_uint_t x, u8g2_uint_t y, const char* s) { return u8g2_DrawStr(&u8g2, x, y, s); }
  void drawHLine(u8g2_uint_t x, u8g2_uint_t y, u8g2_uint_t w) { u8g2_DrawHLine(&u8g2, x, y, w); }
  void drawBox(u8g2_uint_t x, u8g2_uint_t y, u8g2_uint_t w, u8g2_uint_t h) { u8g2_DrawBox(&u8g2, x, y, w, h); }
  void drawRBox(u8g2_uint_t x, u8g2_uint_t y, u8g2_uint_t w, u8g2_uint_t h, u8g2_uint_t r) { u8g2_DrawRBox(&u8g2, x, y, w, h, r); }
  void drawFrame(u8g2_uint_t x, u8g2_uint_t y, u8g2_uint_t w, u8g2_uint_t h) { u8g2_DrawFrame(&u8g2, x, y, w, h); }
  void drawPixel(u8g2_uint_t x, u8g2_uint_t y) { u8g2_DrawPixel(&u8g2, x, y); }
  void clearBuffer() { u8g2_ClearBuffer(&u8g2); }
  void sendBuffer() { scan_r1_on_frame(&u8g2); }
  u8g2_t* getU8g2() { return &u8g2; }
  u8g2_t u8g2;
};
