import type { ComponentPropsWithRef } from 'react';
import { Icon, type IconName } from './Icon';

type Props = ComponentPropsWithRef<'button'> & { label: string; icon: IconName };
/** Icon-only button. The label is its accessible name and tooltip. */
export function IconButton({ label, icon, className = '', ...props }: Props) {
  return <button type="button" className={`icon-button ${className}`.trim()} aria-label={label} title={label} {...props}><Icon name={icon} /></button>;
}
