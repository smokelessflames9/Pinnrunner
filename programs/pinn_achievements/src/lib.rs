use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use mpl_bubblegum::instructions::MintToCollectionV1CpiBuilder;
use mpl_bubblegum::types::{Collection, Creator, MetadataArgs, TokenProgramVersion, TokenStandard};

declare_id!("PinnAchv11111111111111111111111111111111111");

pub const MPL_BUBBLEGUM_ID: Pubkey =
    pubkey!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");

pub const SPL_ACCOUNT_COMPRESSION_ID: Pubkey =
    pubkey!("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");

pub const MPL_TOKEN_METADATA_ID: Pubkey =
    pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

pub const SPL_NOOP_ID: Pubkey =
    pubkey!("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");

pub const ACHIEVEMENT_SYMBOL: &str = "PINNACHV";

#[program]
pub mod pinn_achievements {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        oracle_authority: Pubkey,
        collection_mint: Pubkey,
        merkle_tree: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.oracle_authority = oracle_authority;
        config.pending_oracle = Pubkey::default();
        config.collection_mint = collection_mint;
        config.merkle_tree = merkle_tree;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_merkle_tree: Option<Pubkey>,
        new_collection_mint: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if let Some(tree) = new_merkle_tree {
            config.merkle_tree = tree;
        }
        if let Some(coll) = new_collection_mint {
            config.collection_mint = coll;
        }
        Ok(())
    }

    pub fn propose_oracle(ctx: Context<ProposeOracle>, new_oracle: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.pending_oracle = new_oracle;
        Ok(())
    }

    pub fn accept_oracle(ctx: Context<AcceptOracle>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.oracle_authority = ctx.accounts.pending_oracle.key();
        config.pending_oracle = Pubkey::default();
        Ok(())
    }

    pub fn unlock_achievement(
        ctx: Context<UnlockAchievement>,
        args: UnlockAchievementArgs,
    ) -> Result<()> {
        // 1. Validate achievement bit index and Metaplex metadata string bounds
        require!(
            args.bit_index < 128,
            AchievementError::InvalidBitIndex
        );
        require!(args.name.len() <= 32, AchievementError::NameTooLong);
        require!(args.uri.len() <= 200, AchievementError::UriTooLong);

        // 2. Enforce idempotency bitmask on the player's registry PDA
        let mask: u128 = 1u128 << args.bit_index;
        let registry = &mut ctx.accounts.player_achievement_registry;

        if registry.player == Pubkey::default() {
            registry.player = ctx.accounts.player.key();
            registry.bump = ctx.bumps.player_achievement_registry;
        }

        require!(
            (registry.unlocked_bitmask & mask) == 0,
            AchievementError::AchievementAlreadyUnlocked
        );

        registry.unlocked_bitmask |= mask;
        registry.total_unlocked = registry.total_unlocked.saturating_add(1);

        // 3. Sign Bubblegum CPI with the `achv_authority` PDA
        let authority_bump = ctx.bumps.achv_authority;
        let authority_seeds: &[&[u8]] = &[b"achv_authority", &[authority_bump]];
        let signer_seeds: &[&[&[u8]]] = &[authority_seeds];

        let metadata = MetadataArgs {
            name: args.name,
            symbol: ACHIEVEMENT_SYMBOL.to_string(),
            uri: args.uri,
            seller_fee_basis_points: 0,
            primary_sale_happened: true,
            is_mutable: false,
            edition_nonce: None,
            token_standard: Some(TokenStandard::NonFungible),
            collection: Some(Collection {
                verified: true,
                key: ctx.accounts.collection_mint.key(),
            }),
            uses: None,
            token_program_version: TokenProgramVersion::Original,
            creators: vec![Creator {
                address: ctx.accounts.achv_authority.key(),
                verified: true,
                share: 100,
            }],
        };

        MintToCollectionV1CpiBuilder::new(&ctx.accounts.bubblegum_program.to_account_info())
            .tree_config(&ctx.accounts.tree_config.to_account_info())
            .leaf_owner(&ctx.accounts.player.to_account_info())
            .leaf_delegate(&ctx.accounts.player.to_account_info())
            .merkle_tree(&ctx.accounts.merkle_tree.to_account_info())
            .payer(&ctx.accounts.achievement_oracle.to_account_info())
            .tree_creator_or_delegate(&ctx.accounts.achv_authority.to_account_info(), true)
            .collection_authority(&ctx.accounts.achv_authority.to_account_info())
            .collection_authority_record_pda(Some(
                &ctx.accounts.collection_authority_record.to_account_info(),
            ))
            .collection_mint(&ctx.accounts.collection_mint.to_account_info())
            .collection_metadata(&ctx.accounts.collection_metadata.to_account_info())
            .edition_account(&ctx.accounts.collection_master_edition.to_account_info())
            .bubblegum_signer(&ctx.accounts.bubblegum_signer.to_account_info())
            .log_wrapper(&ctx.accounts.log_wrapper.to_account_info())
            .compression_program(&ctx.accounts.compression_program.to_account_info())
            .token_metadata_program(&ctx.accounts.token_metadata_program.to_account_info())
            .system_program(&ctx.accounts.system_program.to_account_info())
            .metadata(metadata)
            .invoke_signed(signer_seeds)?;

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UnlockAchievementArgs {
    pub bit_index: u8,
    pub name: String,
    pub uri: String,
}

// ---------------------------------------------------------------------------
// Global Achievement Program Configuration Account
// Stores the authorized oracle, pending oracle for 2-step rotation,
// whitelisted collection mint, whitelisted Bubblegum Merkle tree, and bump.
// ---------------------------------------------------------------------------
#[account]
pub struct PinnConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub pending_oracle: Pubkey,
    pub collection_mint: Pubkey,
    pub merkle_tree: Pubkey,
    pub bump: u8,
}

impl PinnConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 1;
}

#[account]
pub struct PlayerAchievementRegistry {
    pub player: Pubkey,
    pub unlocked_bitmask: u128,
    pub total_unlocked: u16,
    pub bump: u8,
}

impl PlayerAchievementRegistry {
    pub const LEN: usize = 8 + 32 + 16 + 2 + 1;
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = PinnConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, PinnConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = admin.key() == config.admin || admin.key() == config.oracle_authority @ AchievementError::UnauthorizedOracle
    )]
    pub config: Account<'info, PinnConfig>,
}

#[derive(Accounts)]
pub struct ProposeOracle<'info> {
    pub oracle_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = oracle_authority.key() == config.oracle_authority @ AchievementError::UnauthorizedOracle
    )]
    pub config: Account<'info, PinnConfig>,
}

#[derive(Accounts)]
pub struct AcceptOracle<'info> {
    pub pending_oracle: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = pending_oracle.key() == config.pending_oracle @ AchievementError::UnauthorizedOracle
    )]
    pub config: Account<'info, PinnConfig>,
}

#[derive(Accounts)]
pub struct UnlockAchievement<'info> {
    #[account(mut)]
    pub achievement_oracle: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
        constraint = achievement_oracle.key() == config.oracle_authority @ AchievementError::UnauthorizedOracle,
        constraint = merkle_tree.key() == config.merkle_tree @ AchievementError::InvalidMerkleTree,
        constraint = collection_mint.key() == config.collection_mint @ AchievementError::InvalidCollectionMint
    )]
    pub config: Account<'info, PinnConfig>,

    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        init_if_needed,
        payer = achievement_oracle,
        space = PlayerAchievementRegistry::LEN,
        seeds = [b"achv_registry", player.key().as_ref()],
        bump
    )]
    pub player_achievement_registry: Account<'info, PlayerAchievementRegistry>,

    /// CHECK: Program PDA signing as Bubblegum tree delegate & collection authority
    #[account(seeds = [b"achv_authority"], bump)]
    pub achv_authority: UncheckedAccount<'info>,

    /// CHECK: Validated by Bubblegum CPI
    #[account(mut)]
    pub tree_config: UncheckedAccount<'info>,

    /// CHECK: Validated against config.merkle_tree and Bubblegum CPI
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: Validated against config.collection_mint and Bubblegum CPI
    pub collection_mint: UncheckedAccount<'info>,

    /// CHECK: Validated by Bubblegum + Token Metadata CPI
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: Validated by Bubblegum + Token Metadata CPI
    pub collection_master_edition: UncheckedAccount<'info>,

    /// CHECK: Delegated CollectionAuthorityRecord PDA validated by Token Metadata CPI
    pub collection_authority_record: UncheckedAccount<'info>,

    /// CHECK: Bubblegum collection CPI signer PDA
    pub bubblegum_signer: UncheckedAccount<'info>,

    /// CHECK: Verified via address constraint against Metaplex Bubblegum program ID
    #[account(address = MPL_BUBBLEGUM_ID @ AchievementError::InvalidBubblegumProgram)]
    pub bubblegum_program: UncheckedAccount<'info>,

    /// CHECK: Verified via address constraint against SPL Account Compression program ID
    #[account(address = SPL_ACCOUNT_COMPRESSION_ID @ AchievementError::InvalidCompressionProgram)]
    pub compression_program: UncheckedAccount<'info>,

    /// CHECK: Verified via address constraint against Metaplex Token Metadata program ID
    #[account(address = MPL_TOKEN_METADATA_ID @ AchievementError::InvalidTokenMetadataProgram)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// CHECK: Verified via address constraint against SPL Noop program ID
    #[account(address = SPL_NOOP_ID @ AchievementError::InvalidLogWrapper)]
    pub log_wrapper: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum AchievementError {
    #[msg("Caller is not the authorized achievement oracle")]
    UnauthorizedOracle,
    #[msg("Achievement bit index must be between 0 and 127")]
    InvalidBitIndex,
    #[msg("Achievement has already been unlocked for this player")]
    AchievementAlreadyUnlocked,
    #[msg("Achievement name exceeds Metaplex 32-byte limit")]
    NameTooLong,
    #[msg("Achievement URI exceeds Metaplex 200-byte limit")]
    UriTooLong,
    #[msg("Merkle tree does not match whitelisted config")]
    InvalidMerkleTree,
    #[msg("Collection mint does not match whitelisted config")]
    InvalidCollectionMint,
    #[msg("Invalid Metaplex Bubblegum program ID")]
    InvalidBubblegumProgram,
    #[msg("Invalid SPL Account Compression program ID")]
    InvalidCompressionProgram,
    #[msg("Invalid Metaplex Token Metadata program ID")]
    InvalidTokenMetadataProgram,
    #[msg("Invalid SPL Noop log wrapper program ID")]
    InvalidLogWrapper,
}
