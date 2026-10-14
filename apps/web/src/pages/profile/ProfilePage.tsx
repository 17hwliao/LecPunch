import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Avatar, Button, Input } from '@lecpunch/ui';
import { useAuthStore } from '@/app/store/auth-store';
import { showToast } from '@/shared/ui/toast';
import { updateProfile } from '@/features/users/users.api';
import { AvatarEditor, type AvatarSelection } from './AvatarEditor';

const profileFormSchema = z.object({
  displayName: z.string().trim().min(2, '显示名称至少 2 个字符')
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const ProfilePage = () => {
  const user = useAuthStore((s) => s.auth.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.auth.token);

  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user?.displayName ?? ''
    }
  });

  useEffect(() => {
    profileForm.reset({
      displayName: user?.displayName ?? ''
    });
  }, [profileForm, user?.displayName]);

  const handleAvatarSave = async (selection: AvatarSelection) => {
    const input =
      selection.type === 'color'
        ? { avatarColor: selection.color }
        : selection.type === 'emoji'
          ? { avatarEmoji: selection.emoji }
          : { avatarBase64: selection.base64 };

    const updated = await updateProfile(input);
    // sync store auth snapshot
    const newUser = { ...user!, ...updated };
    setAuth({ token, user: newUser });
    showToast('头像已更新');
    setShowAvatarEditor(false);
  };

  const handleProfileSave = profileForm.handleSubmit(async (values) => {
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ displayName: values.displayName.trim() });
      const newUser = { ...user!, ...updated };
      setAuth({ token, user: newUser });
      profileForm.reset({ displayName: newUser.displayName });
      showToast('资料已保存');
    } catch {
      showToast('保存失败，请稍后重试', 'error');
    } finally {
      setSavingProfile(false);
    }
  });

  const roleLabel = user?.role === 'admin' ? '管理员' : '成员';

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">个人信息</h1>

      {/* Avatar Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center gap-6">
        <Avatar
          name={user?.displayName ?? '用户'}
          size="lg"
          avatarUrl={user?.avatar}
          avatarBase64={user?.avatarBase64}
          avatarEmoji={user?.avatarEmoji}
          avatarColor={user?.avatarColor}
          className="w-20 h-20 text-2xl"
        />
        <div>
          <p className="text-sm text-gray-500 mb-2">头像</p>
          {user?.avatar ? <p className="text-sm text-gray-500">由 LecSSO 统一管理</p> : <Button variant="outline" size="sm" onClick={() => setShowAvatarEditor(true)}>
            更换头像
          </Button>}
        </div>
      </div>

      {/* Basic Info Section */}
      <form className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4" onSubmit={handleProfileSave}>
        <h2 className="font-bold text-gray-800">基本信息</h2>

        <Controller
          control={profileForm.control}
          name="displayName"
          render={({ field }) => (
            <Input
              id="displayName"
              label="显示名称"
              value={field.value}
              onChange={field.onChange}
              error={profileForm.formState.errors.displayName?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">真实姓名</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">学号</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.studentNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">入学年份</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.enrollYear ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">登录账号</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{user?.username ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">角色</p>
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{roleLabel}</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={savingProfile}>
            保存修改
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-gray-800">账号安全</h2>
        <p className="mt-2 text-sm text-gray-500">密码和身份资料由 LEC SSO 统一管理。</p>
      </div>

      {/* Avatar Editor Modal */}
      {showAvatarEditor ? (
        <AvatarEditor
          initialColor={user?.avatarColor}
          initialEmoji={user?.avatarEmoji}
          onSave={handleAvatarSave}
          onClose={() => setShowAvatarEditor(false)}
        />
      ) : null}
    </div>
  );
};
