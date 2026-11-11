pub mod commands;
// The standalone application (window, sounds, close handling, quitting). A host that embeds Ember builds this
// crate with `default-features = false`: it needs none of this, and `generate_context!` would require the
// standalone app's frontend build.
#[cfg(feature = "standalone")]
mod standalone;
#[cfg(feature = "standalone")]
pub use standalone::run;

mod backup;
mod import;
mod storage;
