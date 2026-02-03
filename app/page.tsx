import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Package, Shield, Users, ArrowRight, CheckCircle } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <Search className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">KIT Lost & Found</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">
            Kirirom Institute of Technology
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
            Lost something on campus?{" "}
            <span className="text-primary">{"We'll help you find it."}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            The official campus lost and found system. Report lost items, register found
            items, and help reunite belongings with their owners.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Report a Lost Item
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Browse Found Items</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Report Items</h3>
                <p className="text-sm text-muted-foreground">
                  Quickly report lost items or register found items with photos and details
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">Smart Matching</h3>
                <p className="text-sm text-muted-foreground">
                  Our system automatically suggests potential matches between lost and found
                  items
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold mb-2">Secure Handover</h3>
                <p className="text-sm text-muted-foreground">
                  Verified claims ensure items are returned to their rightful owners
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">150+</div>
              <div className="text-sm text-muted-foreground">Items Returned</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">85%</div>
              <div className="text-sm text-muted-foreground">Recovery Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">{"<"}24h</div>
              <div className="text-sm text-muted-foreground">Avg. Match Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-12">Who Can Use This System?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Students</h3>
                    <Badge variant="secondary">Reporter</Badge>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Report lost items
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Search found items
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Submit claims
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Staff / Security</h3>
                    <Badge variant="default">Handler</Badge>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Register found items
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Manage storage
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Verify claims
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Administrators</h3>
                    <Badge className="bg-accent text-accent-foreground">Admin</Badge>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Manage users
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Moderate content
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-accent mt-0.5" />
                    Access audit logs
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">
            Join the KIT campus community and help make our campus a better place by reuniting
            lost items with their owners.
          </p>
          <Button size="lg" asChild>
            <Link href="/register">
              Create Your Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 bg-primary rounded">
                <Search className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">KIT Lost & Found</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 KIT Lost and Found. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
