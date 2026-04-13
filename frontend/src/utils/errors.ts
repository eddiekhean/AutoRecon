/**
 * Map structured API error codes and HTTP status codes to safe, user-facing
 * Vietnamese strings. Raw server messages are never shown directly — an
 * attacker-controlled API response cannot inject arbitrary text into the UI.
 */

const API_ERROR_CODES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không chính xác.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
  PASSWORD_CHANGE_REQUIRED: 'Vui lòng đổi mật khẩu trước khi tiếp tục.',
  USER_NOT_FOUND: 'Không tìm thấy người dùng.',
  EMAIL_ALREADY_EXISTS: 'Email đã được sử dụng bởi tài khoản khác.',
  INVALID_OLD_PASSWORD: 'Mật khẩu hiện tại không chính xác.',
};

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Tài khoản không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy tài nguyên yêu cầu.',
  409: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.',
  429: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  500: 'Lỗi hệ thống. Vui lòng liên hệ quản trị viên.',
};

export const getApiErrorMessage = (
  err: unknown,
  fallback = 'Có lỗi xảy ra. Vui lòng thử lại.'
): string => {
  const response = (err as any)?.response;
  const code: string | undefined = response?.data?.code;
  const status: number | undefined = response?.status;

  if (code && API_ERROR_CODES[code]) return API_ERROR_CODES[code];
  if (status && HTTP_STATUS_MESSAGES[status]) return HTTP_STATUS_MESSAGES[status];
  return fallback;
};
