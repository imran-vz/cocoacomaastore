import { EmailText } from "@/components/ui/email-text";
import { ListRow, ListRowTile, ListSection, RecordList, RecordListSkeleton } from "@/components/ui/list-row";
import { PageHeader, PageHeaderSkeleton } from "@/components/ui/page-header";
import { SectionHeadingSkeleton } from "@/components/ui/section-heading";
import { FieldSkeleton, Skeleton, skeletonSlots } from "@/components/ui/skeleton";
import { AREA_LABEL, type Area, type StaffUser } from "@/features/access/area";
import { ChangePasswordForm } from "@/features/access/change-password-form";
import { UserAvatar } from "@/features/shell/account-menu";
import { settingsHub } from "@/features/shell/routes";

/**
 * Settings for both areas (DESIGN.md §Settings): the area's store pages, the signed-in
 * account and its password, as grouped inset lists with one left edge.
 */
export function SettingsPage({ user }: { user: StaffUser }) {
	const settings = settingsHub(user.area);
	const storePages = settings.pages;

	return (
		<div className="w-full">
			<PageHeader title={settings.label} description={settings.description} />
			<div className="space-y-6">
				{storePages.length > 0 ? (
					<ListSection title="Store">
						<RecordList aria-label="Store settings">
							{storePages.map((page) => (
								<ListRow
									key={page.href}
									href={page.href}
									leading={
										<ListRowTile>
											<page.icon />
										</ListRowTile>
									}
									title={page.label}
									meta={page.description}
								/>
							))}
						</RecordList>
					</ListSection>
				) : null}

				<ListSection title="Account" id="account">
					<RecordList aria-label="Account">
						<ListRow
							leading={<UserAvatar user={user} size="lg" />}
							title={user.name}
							meta={<EmailText email={user.email} />}
							trailingMeta={AREA_LABEL[user.area]}
						/>
					</RecordList>
				</ListSection>

				<ListSection title="Password" id="password">
					<ChangePasswordForm />
				</ListSection>
			</div>
		</div>
	);
}

/** Settings: header, the store pages, the account row and the password card. */
export function SettingsSkeleton({ area }: { area: Area }) {
	const storeRows = settingsHub(area).pages.length;
	return (
		<div aria-hidden="true">
			<PageHeaderSkeleton titleWidth="w-28" description />
			<div className="space-y-6">
				{storeRows > 0 ? (
					<section>
						<SectionHeadingSkeleton width="w-12" />
						<RecordListSkeleton rows={storeRows} leading chevron />
					</section>
				) : null}
				<section>
					<SectionHeadingSkeleton width="w-16" />
					<RecordListSkeleton rows={1} leading trailing />
				</section>
				<section>
					<SectionHeadingSkeleton width="w-20" />
					<div className="surface-card space-y-4 p-4 md:p-5">
						{skeletonSlots(3, "field").map((slot) => (
							<div key={slot} className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<FieldSkeleton />
							</div>
						))}
						<FieldSkeleton className="md:w-36" />
					</div>
				</section>
			</div>
		</div>
	);
}
