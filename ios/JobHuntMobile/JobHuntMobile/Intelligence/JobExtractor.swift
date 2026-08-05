import Foundation

protocol JobExtracting {
    func extract(from source: String, sharedURL: URL?) async -> JobDraft
}

struct FallbackJobExtractor: JobExtracting {
    func extract(from source: String, sharedURL: URL?) async -> JobDraft {
        let title = source.split(separator: "\n").first.map(String.init) ?? ""
        return JobDraft(role: title, url: sharedURL?.absoluteString ?? "", sourceText: source, needsReview: true)
    }
}
