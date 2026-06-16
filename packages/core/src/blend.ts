import {
  PoolV2,
  TokenMetadata,
  type Network,
  type Reserve,
} from '@blend-capital/blend-sdk';

export interface PoolReserveInfo {
  index: number;
  assetId: string;
  symbol: string;
  supplyApr: number;
  borrowApr: number;
}

export interface UserPositionLine {
  index: number;
  assetId: string;
  symbol: string;
  collateral: number;
  supplied: number;
  borrowed: number;
}

export interface PoolDisplayInfo {
  poolId: string;
  name: string;
  reserveCount: number;
  reserves: PoolReserveInfo[];
}

export interface UserPositionDisplay {
  userAddress: string;
  hasPosition: boolean;
  pool: PoolDisplayInfo;
  positions: UserPositionLine[];
}

function shortAssetId(assetId: string): string {
  return `${assetId.slice(0, 4)}…${assetId.slice(-4)}`;
}

async function loadSymbol(
  network: Network,
  assetId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(assetId);
  if (cached) return cached;

  try {
    const meta = await TokenMetadata.load(network, assetId);
    cache.set(assetId, meta.symbol);
    return meta.symbol;
  } catch {
    const fallback = shortAssetId(assetId);
    cache.set(assetId, fallback);
    return fallback;
  }
}

function reserveInfo(reserve: Reserve, index: number, symbol: string): PoolReserveInfo {
  return {
    index,
    assetId: reserve.assetId,
    symbol,
    supplyApr: reserve.supplyApr,
    borrowApr: reserve.borrowApr,
  };
}

function hasNonZeroPosition(line: UserPositionLine): boolean {
  return line.collateral > 0 || line.supplied > 0 || line.borrowed > 0;
}

export async function loadUserPositionDisplay(
  network: Network,
  poolId: string,
  userAddress: string,
): Promise<UserPositionDisplay> {
  const pool = await PoolV2.load(network, poolId);
  const poolUser = await pool.loadUser(userAddress);
  const positions = poolUser.positions;
  const symbolCache = new Map<string, string>();

  const reserveList = pool.metadata.reserveList;
  const poolReserves: PoolReserveInfo[] = [];
  const userLines: UserPositionLine[] = [];

  for (let index = 0; index < reserveList.length; index++) {
    const assetId = reserveList[index];
    const reserve = pool.reserves.get(assetId);
    if (!reserve) continue;

    const symbol = await loadSymbol(network, assetId, symbolCache);
    poolReserves.push(reserveInfo(reserve, index, symbol));

    const collateralRaw = positions.collateral.get(index);
    const supplyRaw = positions.supply.get(index);
    const liabilityRaw = positions.liabilities.get(index);

    const line: UserPositionLine = {
      index,
      assetId,
      symbol,
      collateral: reserve.toAssetFromBTokenFloat(collateralRaw),
      supplied: reserve.toAssetFromBTokenFloat(supplyRaw),
      borrowed: reserve.toAssetFromDTokenFloat(liabilityRaw),
    };

    if (hasNonZeroPosition(line)) {
      userLines.push(line);
    }
  }

  return {
    userAddress,
    hasPosition: userLines.length > 0,
    pool: {
      poolId,
      name: pool.metadata.name,
      reserveCount: poolReserves.length,
      reserves: poolReserves,
    },
    positions: userLines,
  };
}
