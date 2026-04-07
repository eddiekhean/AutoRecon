import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Mật khẩu cũ là bắt buộc'),
  new_password: z
    .string()
    .min(12, 'Mật khẩu mới phải có ít nhất 12 ký tự')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
      'Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt'
    ),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Xác nhận mật khẩu không khớp',
  path: ['confirm_password'],
});

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const provisionUserSchema = z.object({
  full_name: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Địa chỉ email không hợp lệ'),
  role_id: z.coerce.number().int().positive('Role ID không hợp lệ'),
});

export type ProvisionUserFormData = z.infer<typeof provisionUserSchema>;

export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export type UserStatus = z.infer<typeof userStatusSchema>;
