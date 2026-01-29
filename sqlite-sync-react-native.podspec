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
  s.source       = { :git => package["repository"]["url"], :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # Vendor the CloudSync xcframework
  s.vendored_frameworks = "ios/CloudSync.xcframework"

  # Dependencies
  s.dependency "React-Core"

  # Required for op-sqlite integration
  s.dependency "React"
end
