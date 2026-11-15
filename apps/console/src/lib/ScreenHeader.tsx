import { PageHeader as UiPageHeader, type PageHeaderProps } from '@hakorem/ui';
import { Breadcrumbs } from '../shells/Breadcrumbs';

/** Every back office page's header: PageHeader with the route's breadcrumbs beneath the title (F5b). */
export function PageHeader(props: PageHeaderProps) {
  return <UiPageHeader breadcrumbs={<Breadcrumbs />} {...props} />;
}
