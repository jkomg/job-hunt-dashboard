import XCTest
@testable import JobHuntMobile

final class JobModelsTests: XCTestCase {
    func testDraftRoundTripsThroughCodable() throws {
        let draft = JobDraft(company: "Acme", role: "Designer", url: "https://example.com", skills: ["Swift"], sourceText: "Designer")
        let data = try JSONEncoder().encode(draft)
        XCTAssertEqual(try JSONDecoder().decode(JobDraft.self, from: data), draft)
    }

    func testFallbackExtractorPreservesSourceAndRequiresReview() async {
        let draft = await FallbackJobExtractor().extract(from: "Product Designer\nAcme", sharedURL: URL(string: "https://example.com"))
        XCTAssertEqual(draft.role, "Product Designer")
        XCTAssertEqual(draft.sourceText, "Product Designer\nAcme")
        XCTAssertTrue(draft.needsReview)
    }
}
