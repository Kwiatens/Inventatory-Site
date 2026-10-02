// Host stand-in for the parts of Arduino.h the Scan R1 display code uses.
#pragma once
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

class String {
 public:
  String() = default;
  String(const char* s) : s_(s ? s : "") {}
  String(const std::string& s) : s_(s) {}
  explicit String(char c) : s_(1, c) {}
  String(int v) : s_(std::to_string(v)) {}
  String(unsigned v) : s_(std::to_string(v)) {}
  String(long v) : s_(std::to_string(v)) {}
  String(unsigned long v) : s_(std::to_string(v)) {}
  String(long long v) : s_(std::to_string(v)) {}
  String(unsigned long long v) : s_(std::to_string(v)) {}
  std::size_t length() const { return s_.size(); }
  const char* c_str() const { return s_.c_str(); }
  void clear() { s_.clear(); }
  String substring(std::size_t from) const { return from >= s_.size() ? String() : String(s_.substr(from)); }
  String substring(std::size_t from, std::size_t to) const {
    if (from > to) std::swap(from, to);
    if (from >= s_.size()) return String();
    return String(s_.substr(from, std::min(to, s_.size()) - from));
  }
  int indexOf(char c, std::size_t from = 0) const { auto p = s_.find(c, from); return p == std::string::npos ? -1 : int(p); }
  int indexOf(const char* c, std::size_t from = 0) const { auto p = s_.find(c, from); return p == std::string::npos ? -1 : int(p); }
  bool startsWith(const String& p) const { return s_.rfind(p.s_, 0) == 0; }
  long toInt() const { return std::strtol(s_.c_str(), nullptr, 10); }
  char operator[](std::size_t i) const { return i < s_.size() ? s_[i] : 0; }
  String& operator+=(const String& o) { s_ += o.s_; return *this; }
  String& operator+=(const char* o) { s_ += o; return *this; }
  String& operator+=(char c) { s_ += c; return *this; }
  friend String operator+(const String& a, const String& b) { return String(a.s_ + b.s_); }
  friend String operator+(const String& a, const char* b) { return String(a.s_ + b); }
  friend String operator+(const char* a, const String& b) { return String(std::string(a) + b.s_); }
  friend String operator+(const String& a, int b) { return a + String(b); }
  friend String operator+(const String& a, long b) { return a + String(b); }
  friend String operator+(const String& a, unsigned long b) { return a + String(b); }
  bool operator==(const String& o) const { return s_ == o.s_; }
  bool operator!=(const String& o) const { return s_ != o.s_; }
  bool operator==(const char* o) const { return s_ == o; }

 private:
  std::string s_;
};

template <typename T, typename L, typename H>
T constrain(T v, L lo, H hi) { return v < T(lo) ? T(lo) : (v > T(hi) ? T(hi) : v); }
template <typename T> T min(T a, T b) { return a < b ? a : b; }
template <typename T> T max(T a, T b) { return a > b ? a : b; }
// A fake clock: the harness moves time, delay() advances it, so the firmware's own timing
// (boot intro, rail sweep, caret blink) plays out exactly as on the device.
extern unsigned long g_scan_r1_now;
inline unsigned long millis() { return g_scan_r1_now; }
void scan_r1_on_delay(unsigned long ms);
inline void delay(unsigned long ms) { scan_r1_on_delay(ms); }
