#include <stdio.h>
#include <string.h>

/* PALLAS 訓練用クラックミー：入力を 1 文字ずつ変換して、埋め込んだ配列と比べる */
static const unsigned char enc[] = {
  0x51,0x5b,0x56,0x50,0x4c,0x45,0x04,0x41,0x04,0x45,0x44,0x06,0x59,0x50,0x68,0x40,0x06,0x43,0x5f,0x68,0x47,0x03,0x5b,0x5b,0x03,0x44,0x4a
};

static int check(const char *s) {
  if (strlen(s) != sizeof(enc)) return 0;
  for (int i = 0; i < (int)sizeof(enc); i++) {
    if (((unsigned char)s[i] ^ 0x37) != enc[i]) return 0;
  }
  return 1;
}

int main(void) {
  char buf[64];
  printf("PASSWORD> ");
  if (!fgets(buf, sizeof(buf), stdin)) return 1;
  buf[strcspn(buf, "\n")] = 0;
  if (check(buf)) {
    puts("Correct! That is the flag.");
  } else {
    puts("Wrong...");
  }
  return 0;
}
