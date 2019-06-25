#
# Determine the health and statistics of this Microsoft DNS Server
#
$Output = New-Object System.Collections.ArrayList
$Date = Get-Date -format 'yyyy-MM-ddTHH:mm:sszzz'
[void]$Output.Add($Date)			

# Name of Server
$ServerName = $env:ComputerName
[void]$Output.Add("Server=`"$ServerName`"")

#
# Windows Version and Build #
#
$WindowsInfo = Get-Item "HKLM:SOFTWARE\Microsoft\Windows NT\CurrentVersion"
$OS = $WindowsInfo.GetValue("ProductName")
$OSSP = $WindowsInfo.GetValue("CSDVersion")
$WinVer = $WindowsInfo.GetValue("CurrentVersion")
$WinBuild = $WindowsInfo.GetValue("CurrentBuildNumber")
$OSVER = "$WinVer ($WinBuild)"

[void]$Output.Add("OperatingSystem=`"$OS`"")
[void]$Output.Add("ServicePack=`"$OSSP`"")
[void]$Output.Add("OSVersion=`"$OSVER`"")

#
# Required Processes Running
#		DNS Dnscache w32time
#
$RequiredServices = @( "DNS", "Dnscache", "w32time" )
$srvr = @()
$srvnr = @()
foreach ($srv in $RequiredServices) {
	$status = (Get-Service $srv).Status
	if ($status -eq "Running") {
		$srvr += $srv
	} else {
		$srvnr += $srv
	}
}

$ProcsOK = "False"
if ($srvnr.Count -eq 0) {
	$ProcsOK = "True"
}

$ServicesRunning = [string]::join(',', $srvr)
$ServicesNotRunning = [string]::join(',', $srvnr)
[void]$Output.Add("ServicesRunning=`"$ServicesRunning`"")
[void]$Output.Add("ServicesNotRunning=`"$ServicesNotRunning`"")
[void]$Output.Add("ProcsOK=`"$ProcsOK`"")

#
# Settings for this DNS Server
#
$dnsInfo = Get-WmiObject -Namespace "root\MicrosoftDNS" -Class MicrosoftDNS_Server -ComputerName $ServerName

# See http://msdn.microsoft.com/en-us/library/windows/desktop/ms682725(v=vs.85).aspx for details
[void]$Output.Add("Name=`"$($dnsInfo.Name)`"")
[void]$Output.Add("Version=`"$($dnsInfo.Version)`"")
[void]$Output.Add("LogLevel=`"$($dnsInfo.LogLevel)`"")
[void]$Output.Add("LogFilePath=`"$($dnsInfo.LogFilePath)`"")
[void]$Output.Add("LogFileMaxSize=`"$($dnsInfo.LogFileMaxSize)`"")
[void]$Output.Add("EventLogLevel=`"$($dnsInfo.EventLogLevel)`"")
[void]$Output.Add("RpcProtocol=`"$($dnsInfo.RpcProtocol)`"")
[void]$Output.Add("NameCheckFlag=`"$NameCheckFlag`"")
[void]$Output.Add("AddressAnswerLimit=`"$($dnsInfo.AddressAnswerLimit)`"")
[void]$Output.Add("RecursionRetry=`"$($dnsInfo.RecursionRetry)`"")
[void]$Output.Add("RecursionTimeout=`"$($dnsInfo.RecursionTimeout)`"")
[void]$Output.Add("DsPollingInterval=`"$($dnsInfo.DsPollingInterval)`"")
[void]$Output.Add("DsTombstoneInteval=`"$($dnsInfo.DsTombstoneInteval)`"")
[void]$Output.Add("MaxCacheTTL=`"$($dnsInfo.MaxCacheTTL)`"")
[void]$Output.Add("MaxNegativeCacheTTL=`"$($dnsInfo.MaxNegativeCacheTTL)`"")
[void]$Output.Add("SendPort=`"$($dnsInfo.SendPort)`"")
[void]$Output.Add("XfrConnectTimeout=`"$($dnsInfo.XfrConnectTimeout)`"")
[void]$Output.Add("BootMethod=`"$($dnsInfo.BootMethod)`"")
[void]$Output.Add("AllowUpdate=`"$($dnsInfo.AllowUpdate)`"")
[void]$Output.Add("UpdateOptions=`"$($dnsInfo.UpdateOptions)`"")
[void]$Output.Add("DsAvailable=`"$($dnsInfo.DsAvailable)`"")
[void]$Output.Add("DisableAutoReverseZones=`"$($dnsInfo.DisableAutoReverseZones)`"")
[void]$Output.Add("AutoCacheUpdate=`"$($dnsInfo.AutoCacheUpdate)`"")
[void]$Output.Add("NoRecursion=`"$($dnsInfo.NoRecursion)`"")
[void]$Output.Add("RoundRobin=`"$($dnsInfo.RoundRobin)`"")
[void]$Output.Add("LocalNetPriority=`"$($dnsInfo.LocalNetPriority)`"")
[void]$Output.Add("StrictFileParsing=`"$($dnsInfo.StrictFileParsing)`"")
[void]$Output.Add("LooseWildcarding=`"$($dnsInfo.LooseWildcarding)`"")
[void]$Output.Add("BindSecondaries=`"$($dnsInfo.BindSecondaries)`"")
[void]$Output.Add("WriteAuthorityNS=`"$($dnsInfo.WriteAuthorityNS)`"")
[void]$Output.Add("ForwardDelegations=`"$($dnsInfo.ForwardDelegations)`"")
[void]$Output.Add("SecureResponses=`"$($dnsInfo.SecureResponses)`"")
[void]$Output.Add("DisjointNets=`"$($dnsInfo.DisjointNets)`"")
[void]$Output.Add("AutoConfigFileZones=`"$($dnsInfo.AutoConfigFileZones)`"")
[void]$Output.Add("ScavengingInterval=`"$($dnsInfo.ScavengingInterval)`"")
[void]$Output.Add("DefaultRefreshInterval=`"$($dnsInfo.DefaultRefreshInterval)`"")
[void]$Output.Add("DefaultNoRefreshInterval=`"$($dnsInfo.DefaultNoRefreshInterval)`"")
[void]$Output.Add("DefaultAgingState=`"$($dnsInfo.DefaultAgingState)`"")
[void]$Output.Add("EDnsCacheTimeout=`"$($dnsInfo.EDnsCacheTimeout)`"")
[void]$Output.Add("EnableEDnsProbes=`"$($dnsInfo.EnableEDnsProbes)`"")
[void]$Output.Add("EnableDnsSec=`"$($dnsInfo.EnableDnsSec)`"")
[void]$Output.Add("ForwardingTimeout=`"$($dnsInfo.ForwardingTimeout)`"")
[void]$Output.Add("IsSlave=`"$($dnsInfo.IsSlave)`"")
[void]$Output.Add("EnableDirectoryPartitions=`"$($dnsInfo.EnableDirectoryPartitions)`"")
[void]$Output.Add("Started=`"$($dnsInfo.Started)`"")
[void]$Output.Add("StartMode=`"$($dnsInfo.StartMode)`"")
[void]$Output.Add("Status=`"$($dnsInfo.Status)`"")

foreach ($ip in $dnsInfo.Forwarders) {
	[void]$Output.Add("Forwarder=`"$ip`"")
}
foreach ($ip in $dnsInfo.ServerAddresses) {
	[void]$Output.Add("ServerAddress=`"$ip`"")
}
foreach ($ip in $dnsInfo.ListenAddresses) {
	[void]$Output.Add("ListenAddress=`"$ip`"")
}

# Output the final string
[string]::join(' ', $Output) | Write-Host