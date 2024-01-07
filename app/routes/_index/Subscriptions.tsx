import * as Ariakit from "@ariakit/react";
import { useQuery } from "@tanstack/react-query";
import { request, gql } from "graphql-request";
import { useState } from "react";
import { formatUnits, getAddress } from "viem";
import { optimism } from "viem/chains";
import { useAccount } from "wagmi";

import incomingImg from "~/assets/icons/incoming.svg";
import outgoingImg from "~/assets/icons/outgoing.svg";
import { EndsIn } from "~/components/EndsIn";
import { Icon } from "~/components/Icon";
import { useHydrated } from "~/hooks/useHydrated";
import { DAI_OPTIMISM } from "~/lib/constants";
import { useGetEnsName } from "~/queries/useGetEnsName";
import { type IFormattedSub, type ISub } from "~/types";

import { Unsubscribe } from "./Unsubscribe";
import { SUB_CHAIN_LIB, formatSubs } from "./utils";

async function getSubscriptions(address?: string) {
	try {
		if (!address) return null;

		const subs = gql`
			{
				subs(
					where: {
						or: [
							{ owner: "${address.toLowerCase()}" },
							{ receiver: "${address.toLowerCase()}" }
						]
					}
					orderBy: realExpiration
					orderDirection: desc
				) {
					id
					owner
					receiver
					startTimestamp
					unsubscribed
					initialShares
					initialPeriod
					expirationDate
					amountPerCycle
					realExpiration
					accumulator
					creationTx
				}
			}
		`;
		const data: { subs: Array<ISub> } = await request(SUB_CHAIN_LIB.subgraphs.subscriptions, subs);

		return formatSubs(data?.subs ?? []);
	} catch (error: any) {
		throw new Error(error.message ?? "Failed to fetch subscriptions");
	}
}

export const Subscriptions = () => {
	const { address } = useAccount();

	const {
		data: subs,
		isLoading: fetchingSubs,
		error: errorFetchingSubs
	} = useQuery(["subs", address], () => getSubscriptions(address), {
		cacheTime: 20_000,
		refetchInterval: 20_000
	});

	const hydrated = useHydrated();

	const [snapshotDate, setSnapshotDate] = useState<string>("");

	const downloadActiveSubs = () => {
		if (subs && snapshotDate !== "" && address) {
			const snapshotTimestamp = new Date(snapshotDate).getTime();
			const activeSubs = subs.filter(
				(sub) =>
					sub.startTimestamp !== sub.realExpiration &&
					+sub.startTimestamp <= snapshotTimestamp / 1e3 &&
					+sub.realExpiration >= snapshotTimestamp / 1e3
			);
			const rows = [["Address", "Amount per month"]];
			activeSubs.forEach((sub) => {
				const incoming = sub.receiver === address.toLowerCase();
				rows.push([
					incoming ? sub.owner : sub.receiver,
					formatUnits(BigInt(sub.amountPerCycle), DAI_OPTIMISM.decimals)
				]);
			});

			download(`subscriptions-snapshot-${snapshotDate}.csv`, rows.map((r) => r.join(",")).join("\n"));
		}
	};
	return (
		<>
			{!hydrated || fetchingSubs ? (
				<p className="text-center text-sm">Loading...</p>
			) : !address ? (
				<p className="text-center text-sm">Connect wallet to view your subscriptions</p>
			) : errorFetchingSubs || !subs ? (
				<p className="text-center text-sm text-red-500">
					{(errorFetchingSubs as any)?.message ?? "Failed to fetch subscriptions"}
				</p>
			) : subs.length === 0 ? (
				<p className="text-center text-sm text-orange-500">You do not have any subscriptions</p>
			) : (
				<>
					<table className="border-collapse">
						<thead>
							<tr>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">Type</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									Address
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">Tier</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									<span className="flex flex-nowrap items-center gap-1">
										<span className="whitespace-nowrap">Total Paid</span>
										<Ariakit.TooltipProvider showTimeout={0}>
											<Ariakit.TooltipAnchor
												render={<Icon name="question-mark-circle" className="h-4 w-4 flex-shrink-0" />}
											/>
											<Ariakit.Tooltip className="max-w-xs cursor-default border border-solid border-black bg-white p-1 text-sm text-black">
												Total paid is different from total deposited, remaining balance can be withdrawn at anytime
											</Ariakit.Tooltip>
										</Ariakit.TooltipProvider>
									</span>
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									Duration
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									Time Left
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									Expiry
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									Status
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">
									Claimables
								</th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]"></th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]"></th>
								<th className="whitespace-nowrap p-3 text-left font-normal text-[#596575] dark:text-[#838486]">Tx</th>
							</tr>
						</thead>
						<tbody>
							{subs.map((sub) => (
								<Sub key={sub.id} data={sub} address={address} />
							))}
						</tbody>
					</table>
					<form className="flex flex-wrap items-end gap-4 text-sm">
						<label className="mt-5 flex flex-col gap-1">
							<span>Snapshot</span>
							<input
								type="date"
								name="snapshot"
								value={snapshotDate}
								onChange={(e) => setSnapshotDate(e.target.value)}
								className="rounded-lg border border-black/[0.15] bg-[#ffffff] p-1 dark:border-white/5 dark:bg-[#141414]"
							/>
						</label>
						<button
							type="button"
							className="rounded-lg border border-black/[0.15] bg-[#13785a] p-1 px-2 text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/5 dark:bg-[#23BF91] dark:text-black"
							onClick={downloadActiveSubs}
							disabled={snapshotDate === ""}
						>
							Download
						</button>
					</form>
				</>
			)}
		</>
	);
};

const Sub = ({ data, address }: { data: IFormattedSub; address: string }) => {
	const status =
		data.startTimestamp === data.realExpiration
			? "Cancelled"
			: +data.startTimestamp > Date.now() / 1e3
				? "Not yet started"
				: +data.realExpiration < Date.now() / 1e3
					? "Expired"
					: "Active";

	const incoming = data.receiver === address.toLowerCase();

	const subAddress = incoming ? data.owner : data.receiver;

	const { data: ensName } = useGetEnsName({
		address: getAddress(subAddress)
	});

	return (
		<tr>
			<td className="p-3">
				{incoming ? <img src={incomingImg} alt="incoming" /> : <img src={outgoingImg} alt="outgoing" />}
			</td>
			<td className="p-3">
				<a
					target="_blank"
					rel="noopene noreferrer"
					href={`https://optimistic.etherscan.io/address/${subAddress}`}
					className="underline"
				>
					{ensName ?? subAddress.slice(0, 4) + "..." + subAddress.slice(-4)}
				</a>
			</td>
			<td className="p-3">
				<span className="flex flex-nowrap items-center gap-1">
					<img src={DAI_OPTIMISM.img} alt="" width={16} height={16} />
					<span className="whitespace-nowrap">{`${formatUnits(
						BigInt(data.amountPerCycle),
						DAI_OPTIMISM.decimals
					)} DAI / month`}</span>
				</span>
			</td>
			<td className="p-3">
				<span className="flex flex-nowrap items-center gap-1">
					<img src={DAI_OPTIMISM.img} alt="" width={16} height={16} />
					<span className="whitespace-nowrap">{`${data.totalAmountPaid} DAI`}</span>
				</span>
			</td>
			<td className="whitespace-nowrap p-3">{data.subDurationFormatted}</td>
			<td className="whitespace-nowrap p-3 tabular-nums">
				{status === "Active" ? <EndsIn deadline={+data.realExpiration * 1000} /> : "-"}
			</td>
			<td className="whitespace-nowrap p-3">{`${new Date(+data.realExpiration * 1000).toLocaleString()}`}</td>
			<td className="whitespace-nowrap p-3">{status}</td>
			{incoming ? (
				<>
					<td className="whitespace-nowrap p-3 text-center"></td>
					<td className="whitespace-nowrap p-3 text-center"></td>
					<td className="whitespace-nowrap p-3 text-center"></td>
				</>
			) : (
				<Unsubscribe data={data} />
			)}
			<td className="whitespace-nowrap p-3 text-center">
				<a
					href={`${optimism.blockExplorers.etherscan.url}/tx/${data.creationTx}`}
					target="_blank"
					rel="noreferrer noopener"
				>
					<Icon name="external-link" className="h-4 w-4" />
					<span className="sr-only">link to transaction on chain</span>
				</a>
			</td>
		</tr>
	);
};

function download(filename: string, text: string) {
	const element = document.createElement("a");
	element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
	element.setAttribute("download", filename);

	element.style.display = "none";
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);
}
