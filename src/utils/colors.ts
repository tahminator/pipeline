export class Colors {
  private static readonly BLACK = "\x1b[30m";
  private static readonly RED = "\x1b[31m";
  private static readonly GREEN = "\x1b[32m";
  private static readonly YELLOW = "\x1b[33m";
  private static readonly BLUE = "\x1b[34m";
  private static readonly MAGENTA = "\x1b[35m";
  private static readonly CYAN = "\x1b[36m";
  private static readonly WHITE = "\x1b[37m";
  private static readonly GRAY = "\x1b[90m";

  private static readonly BRIGHT_RED = "\x1b[91m";
  private static readonly BRIGHT_GREEN = "\x1b[92m";
  private static readonly BRIGHT_YELLOW = "\x1b[93m";
  private static readonly BRIGHT_BLUE = "\x1b[94m";
  private static readonly BRIGHT_MAGENTA = "\x1b[95m";
  private static readonly BRIGHT_CYAN = "\x1b[96m";
  private static readonly BRIGHT_WHITE = "\x1b[97m";

  private static readonly PINK = "\x1b[38;5;213m";
  private static readonly ORANGE = "\x1b[38;5;214m";

  private static readonly RESET = "\x1b[0m";
  private static readonly BOLD = "\x1b[1m";
  private static readonly DIM = "\x1b[2m";
  private static readonly ITALIC = "\x1b[3m";
  private static readonly UNDERLINE = "\x1b[4m";

  static black(s: string) {
    return `${Colors.BLACK}${s}${Colors.RESET}`;
  }

  static red(s: string) {
    return `${Colors.RED}${s}${Colors.RESET}`;
  }

  static green(s: string) {
    return `${Colors.GREEN}${s}${Colors.RESET}`;
  }

  static yellow(s: string) {
    return `${Colors.YELLOW}${s}${Colors.RESET}`;
  }

  static blue(s: string) {
    return `${Colors.BLUE}${s}${Colors.RESET}`;
  }

  static magenta(s: string) {
    return `${Colors.MAGENTA}${s}${Colors.RESET}`;
  }

  static cyan(s: string) {
    return `${Colors.CYAN}${s}${Colors.RESET}`;
  }

  static white(s: string) {
    return `${Colors.WHITE}${s}${Colors.RESET}`;
  }

  static gray(s: string) {
    return `${Colors.GRAY}${s}${Colors.RESET}`;
  }

  static brightRed(s: string) {
    return `${Colors.BRIGHT_RED}${s}${Colors.RESET}`;
  }

  static brightGreen(s: string) {
    return `${Colors.BRIGHT_GREEN}${s}${Colors.RESET}`;
  }

  static brightYellow(s: string) {
    return `${Colors.BRIGHT_YELLOW}${s}${Colors.RESET}`;
  }

  static brightBlue(s: string) {
    return `${Colors.BRIGHT_BLUE}${s}${Colors.RESET}`;
  }

  static brightMagenta(s: string) {
    return `${Colors.BRIGHT_MAGENTA}${s}${Colors.RESET}`;
  }

  static brightCyan(s: string) {
    return `${Colors.BRIGHT_CYAN}${s}${Colors.RESET}`;
  }

  static brightWhite(s: string) {
    return `${Colors.BRIGHT_WHITE}${s}${Colors.RESET}`;
  }

  static pink(s: string) {
    return `${Colors.PINK}${s}${Colors.RESET}`;
  }

  static orange(s: string) {
    return `${Colors.ORANGE}${s}${Colors.RESET}`;
  }

  static bold(s: string) {
    return `${Colors.BOLD}${s}${Colors.RESET}`;
  }

  static dim(s: string) {
    return `${Colors.DIM}${s}${Colors.RESET}`;
  }

  static italic(s: string) {
    return `${Colors.ITALIC}${s}${Colors.RESET}`;
  }

  static underline(s: string) {
    return `${Colors.UNDERLINE}${s}${Colors.RESET}`;
  }
}
