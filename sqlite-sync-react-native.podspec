require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "sqlite-sync-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0" }
  s.source       = { :http => "https://github.com/sqliteai/sqlite-sync-dev/releases/download/v#{s.version}/cloudsync-apple-xcframework-#{s.version}.zip" }

  s.vendored_frameworks = "CloudSync.xcframework"

  # Dependencies
  s.dependency "React-Core"
  s.dependency "React"
end
