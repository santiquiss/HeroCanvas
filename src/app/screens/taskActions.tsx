// What a task can open from any screen: the new-task editor (a sheet on phones, a dialog on large screens), a task's
// actions (an action sheet, or a menu hanging from its button), the delete confirmation and the undo snackbar. One
// place, so the screens that show tasks share them.
import { useState } from 'react';
import { Button } from '../../kit';
import { useActionSheet } from '../../sim/actionSheet';
import { useSim } from '../../sim/SimContext';
import { TextField } from '../components';
import type { Task } from '../data/tasks';
import { useT, type T } from '../i18n';
import { useTasks } from '../state';
import styles from './screens.module.css';

/** Opens the new-task editor. */
export function useNewTask() {
  const { openSheet, showSnackbar } = useSim();
  const t = useT();
  const { add } = useTasks();
  return (project?: string) =>
    openSheet({
      id: 'newTask',
      kind: 'task',
      width: 'medium',
      content: (close) => (
        <NewTask
          t={t}
          onCancel={close}
          onSave={(title) => {
            add(title, project);
            close();
            showSnackbar({ text: t('new.added'), level: 'success' });
          }}
        />
      ),
    });
}

function NewTask({ t, onCancel, onSave }: { t: T; onCancel: () => void; onSave: (title: string) => void }) {
  const [title, setTitle] = useState('');
  const ok = title.trim().length > 0;
  return (
    <div className={styles.editor}>
      <div className={styles.editorBar}>
        <Button label={t('common.cancel')} variant="link" onPressed={onCancel} />
        <span className={styles.editorTitle}>{t('new.title')}</span>
        <Button label={t('new.save')} size="small" onPressed={ok ? () => onSave(title.trim()) : undefined} />
      </div>
      <TextField value={title} hintText={t('new.hint')} autofocus onChanged={setTitle} onSubmitted={(v) => v.trim() && onSave(v.trim())} />
    </div>
  );
}

/** Opens a task's actions; `after` runs once it's deleted (a task's page closes). */
export function useTaskActions() {
  const actionSheet = useActionSheet();
  const { openDialog, showSnackbar } = useSim();
  const t = useT();
  const { toggle, remove } = useTasks();
  return (task: Task, after?: () => void) =>
    actionSheet({
      actions: [
        { label: task.done ? t('task.markUndone') : t('task.markDone'), icon: task.done ? 'radio_button_unchecked' : 'check_circle', onTap: () => toggle(task.id) },
        { label: t('task.share'), icon: 'ios_share', onTap: () => showSnackbar({ text: t('task.share') }) },
      ],
      destructiveActions: [
        {
          label: t('task.delete'),
          icon: 'delete',
          onTap: () =>
            openDialog({
              title: t('task.deleteTitle'),
              content: t('task.deleteBody'),
              actionsAlignment: 'vertical',
              primaryButtonText: t('task.delete'),
              primaryButtonVariant: 'danger',
              secondaryButtonText: t('common.cancel'),
              onPrimaryButtonPressed: () => {
                const undo = remove(task.id);
                after?.();
                showSnackbar({ text: t('task.deleted'), action: { icon: 'undo', semanticLabel: t('task.undo'), onPressed: undo } });
              },
            }),
        },
      ],
    });
}

/** When a task is due, in words ("Today", "In 3 days"). */
export function dueText(t: T, due: number | undefined): string {
  if (due == null) return t('task.noDate');
  if (due === 0) return t('today.dueToday');
  if (due === 1) return t('today.tomorrow');
  if (due === -1) return t('today.yesterday');
  return due > 0 ? t('today.inDays', { n: due }) : t('today.overdue');
}
