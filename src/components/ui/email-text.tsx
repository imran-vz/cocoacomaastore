/** An email address that may wrap after the "@" (never mid-word) when its row is too narrow. */
export function EmailText({ email }: { email: string }) {
	const at = email.indexOf("@");
	if (at <= 0) return <span className="block break-words">{email}</span>;
	return (
		<span className="block break-words">
			{email.slice(0, at + 1)}
			<wbr />
			{email.slice(at + 1)}
		</span>
	);
}
