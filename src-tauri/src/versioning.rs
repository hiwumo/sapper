use crate::models::CompatibilityStatus;

/// Represents a link in the version history chain
#[derive(Debug, Clone)]
pub struct VersionLink {
    pub from: &'static str,
    pub to: &'static str,
    pub compatibility: CompatibilityStatus,
}

/// Version history chain for Sapper import format
/// Format: version_from -> version_to with compatibility status
pub const VERSION_HISTORY: &[VersionLink] = &[
    VersionLink {
        from: "0.1.0",
        to: "0.2.0",
        compatibility: CompatibilityStatus::Compatible,
    },
    VersionLink {
        from: "0.2.0",
        to: "0.3.0",
        compatibility: CompatibilityStatus::Incompatible,
    },
    VersionLink {
        from: "0.3.0",
        to: "0.3.1",
        compatibility: CompatibilityStatus::Incompatible,
    },
];

/// Current version of the import format
pub const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Check if two versions are compatible by traversing the version chain
/// Returns (is_compatible, needs_update)
pub fn check_compatibility(import_version: &str, current_version: &str) -> (bool, bool) {
    // If versions are the same, they're compatible and don't need update
    if import_version == current_version {
        return (true, false);
    }

    // Try to find a path from import_version to current_version
    let (found_path, has_incompatible) = find_version_path(import_version, current_version);

    if !found_path {
        // No path found - treat as incompatible
        return (false, true);
    }

    if has_incompatible {
        // Path found but has incompatible links
        return (false, true);
    }

    // Path found and all links are compatible - needs update but is compatible
    (true, true)
}

/// Find a path from start_version to end_version
/// Returns (path_exists, has_incompatible_link)
fn find_version_path(start: &str, end: &str) -> (bool, bool) {
    use std::collections::{HashMap, HashSet, VecDeque};

    // Build adjacency list
    let mut graph: HashMap<&str, Vec<(&str, CompatibilityStatus)>> = HashMap::new();
    for link in VERSION_HISTORY {
        graph
            .entry(link.from)
            .or_insert_with(Vec::new)
            .push((link.to, link.compatibility.clone()));
    }

    // BFS to find path
    let mut queue = VecDeque::new();
    let mut visited = HashSet::new();
    let mut parent: HashMap<&str, (&str, CompatibilityStatus)> = HashMap::new();

    queue.push_back(start);
    visited.insert(start);

    while let Some(current) = queue.pop_front() {
        if current == end {
            // Reconstruct path and check for incompatibilities
            let mut has_incompatible = false;
            let mut node = end;

            while let Some((prev, status)) = parent.get(node) {
                if *status == CompatibilityStatus::Incompatible {
                    has_incompatible = true;
                    break;
                }
                node = prev;
            }

            return (true, has_incompatible);
        }

        if let Some(neighbors) = graph.get(current) {
            for (neighbor, status) in neighbors {
                if !visited.contains(neighbor) {
                    visited.insert(neighbor);
                    parent.insert(neighbor, (current, status.clone()));
                    queue.push_back(neighbor);
                }
            }
        }
    }

    // No path found
    (false, false)
}

/// Get all versions that need updating
pub fn get_outdated_versions() -> Vec<&'static str> {
    use std::collections::HashSet;

    let mut all_versions: HashSet<&str> = HashSet::new();
    for link in VERSION_HISTORY {
        all_versions.insert(link.from);
        all_versions.insert(link.to);
    }

    all_versions
        .into_iter()
        .filter(|v| *v != CURRENT_VERSION)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_same_version() {
        let (compatible, needs_update) = check_compatibility("0.3.0", "0.3.0");
        assert!(compatible);
        assert!(!needs_update);
    }

    #[test]
    fn test_compatible_upgrade() {
        let (compatible, needs_update) = check_compatibility("0.1.0", "0.2.0");
        assert!(compatible);
        assert!(needs_update);
    }

    #[test]
    fn test_incompatible_upgrade() {
        let (compatible, needs_update) = check_compatibility("0.2.0", "0.3.0");
        assert!(!compatible);
        assert!(needs_update);
    }

    #[test]
    fn test_incompatible_chain() {
        // 0.1.0 -> 0.2.0 (compatible) -> 0.3.0 (incompatible)
        let (compatible, needs_update) = check_compatibility("0.1.0", "0.3.0");
        assert!(!compatible);
        assert!(needs_update);
    }

    #[test]
    fn test_compatible_chain() {
        // 0.3.0 -> 0.3.1 (compatible)
        let (compatible, needs_update) = check_compatibility("0.3.0", "0.3.1");
        assert!(compatible);
        assert!(needs_update);
    }

    #[test]
    fn test_unknown_version() {
        let (compatible, needs_update) = check_compatibility("0.0.1", "0.3.0");
        assert!(!compatible);
        assert!(needs_update);
    }
}
