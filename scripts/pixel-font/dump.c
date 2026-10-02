/* Dumps U8g2 bitmap fonts (the ones the Scan R1 uses, plus small mono faces) to JSON so the
 * website can draw pixel text with the same glyphs. Each glyph is drawn by u8g2 itself into a
 * stub full-buffer display and read back pixel by pixel.
 * Output: { name: { top, height, glyphs: { code: [advance, left, width, "rows as 0/1"] } } } */
#include <stdio.h>
#include <string.h>
#include "u8g2.h"

static uint8_t stub(u8x8_t *a, uint8_t b, uint8_t c, void *d) { (void)a; (void)b; (void)c; (void)d; return 1; }
static u8g2_t g;
static int px(int x, int y) {
  const uint8_t *buf = u8g2_GetBufferPtr(&g);
  return buf[(y / 8) * u8g2_GetBufferTileWidth(&g) * 8 + x] >> (y & 7) & 1;
}

static void dump(const char *name, const uint8_t *font, int last) {
  const int X = 20, BASE = 44;
  u8g2_SetFont(&g, font);
  u8g2_SetFontMode(&g, 1);
  /* Common vertical extent of all glyphs. */
  int top = 64, bottom = -1;
  for (int c = 32; c <= last; c++) {
    if (!u8g2_IsGlyph(&g, c)) continue;
    u8g2_ClearBuffer(&g);
    u8g2_DrawGlyph(&g, X, BASE, c);
    for (int y = 0; y < 64; y++) for (int x = 0; x < 128; x++) if (px(x, y)) { if (y < top) top = y; if (y > bottom) bottom = y; }
  }
  printf("\"%s\":{\"top\":%d,\"height\":%d,\"glyphs\":{", name, top - BASE, bottom - top + 1);
  int first = 1;
  for (int c = 32; c <= last; c++) {
    if (!u8g2_IsGlyph(&g, c)) continue;
    u8g2_ClearBuffer(&g);
    u8g2_DrawGlyph(&g, X, BASE, c);
    int adv = u8g2_GetGlyphWidth(&g, c);
    int x0 = 128, x1 = -1;
    for (int y = top; y <= bottom; y++) for (int x = 0; x < 128; x++) if (px(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (x1 < 0) { x0 = X; x1 = X - 1; }
    printf("%s\"%d\":[%d,%d,%d,\"", first ? "" : ",", c, adv, x0 - X, x1 - x0 + 1);
    for (int y = top; y <= bottom; y++) for (int x = x0; x <= x1; x++) putchar(px(x, y) ? '1' : '0');
    printf("\"]");
    first = 0;
  }
  printf("}}");
}

int main(void) {
  u8g2_Setup_st7565_erc12864_alt_f(&g, U8G2_R0, stub, stub);
  u8g2_InitDisplay(&g);
  printf("{");
  dump("mono", u8g2_font_5x7_tf, 255); printf(",");
  dump("tiny", u8g2_font_4x6_tf, 255); printf(",");
  dump("sans", u8g2_font_helvR08_tf, 255); printf(",");
  dump("bold", u8g2_font_helvB08_tf, 255); printf(",");
  dump("title", u8g2_font_helvB10_tf, 255); printf(",");
  dump("big", u8g2_font_helvB12_tf, 255);
  printf("}\n");
  return 0;
}
